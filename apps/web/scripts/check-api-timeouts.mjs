import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import ts from "typescript"

const sourcePath = fileURLToPath(new URL("../lib/api-client.ts", import.meta.url))
const sourceText = readFileSync(sourcePath, "utf8")
const sourceFile = ts.createSourceFile(
  sourcePath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
)

function findVariableInitializer(name) {
  let result
  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === name
    ) {
      result = node.initializer
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return result
}

function findFunction(name) {
  return sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement)
      && statement.name?.text === name,
  )
}

function findCall(node, name) {
  let result
  function visit(candidate) {
    if (
      ts.isCallExpression(candidate)
      && ts.isIdentifier(candidate.expression)
      && candidate.expression.text === name
    ) {
      result = candidate
    }
    ts.forEachChild(candidate, visit)
  }
  visit(node)
  return result
}

const defaultTimeout = findVariableInitializer("DEFAULT_API_TIMEOUT_MS")
const llmTimeout = findVariableInitializer("LLM_OPERATION_TIMEOUT_MS")
assert.equal(defaultTimeout?.getText(sourceFile), "20_000")
assert.equal(llmTimeout?.getText(sourceFile), "110_000")

const diagnoseFunction = findFunction("diagnose")
assert.ok(diagnoseFunction?.body, "diagnose() must remain a declared function")

const diagnoseApiFetch = findCall(diagnoseFunction.body, "apiFetch")

assert.ok(diagnoseApiFetch, "diagnose() must call apiFetch()")
assert.equal(
  diagnoseApiFetch.arguments[2]?.getText(sourceFile),
  "LLM_OPERATION_TIMEOUT_MS",
  "diagnose() must use the 110-second LLM timeout instead of the 20-second default",
)

const speechFunction = findFunction("synthesizeCoachSpeech")
assert.ok(speechFunction?.body, "synthesizeCoachSpeech() must remain a declared function")
const speechTimedFetch = findCall(speechFunction.body, "fetchWithTotalTimeout")
assert.ok(speechTimedFetch, "synthesizeCoachSpeech() must use the total-timeout helper")
assert.equal(
  speechTimedFetch.arguments[2]?.getText(sourceFile),
  "LLM_OPERATION_TIMEOUT_MS",
  "Coach Speech must use the 110-second model-operation deadline",
)

const helperPath = fileURLToPath(new URL("../lib/timed-fetch.ts", import.meta.url))
const helperSource = readFileSync(helperPath, "utf8")
const helperJavaScript = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: helperPath,
}).outputText
const helperUrl = `data:text/javascript;base64,${Buffer.from(helperJavaScript).toString("base64")}`
const { fetchWithTotalTimeout } = await import(helperUrl)

const originalFetch = globalThis.fetch
function delayedJsonFetch(delayMs) {
  return async (_input, init) => {
    const encoder = new TextEncoder()
    return new Response(new ReadableStream({
      start(controller) {
        const bodyTimer = setTimeout(() => {
          controller.enqueue(encoder.encode('{"ok":true}'))
          controller.close()
        }, delayMs)
        init.signal.addEventListener("abort", () => {
          clearTimeout(bodyTimer)
          controller.error(new DOMException("Aborted", "AbortError"))
        }, { once: true })
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}

try {
  globalThis.fetch = delayedJsonFetch(60)
  await assert.rejects(
    () => fetchWithTotalTimeout(
      "https://example.test/stream",
      {},
      10,
      (response) => response.json(),
    ),
    /request timed out/i,
    "the deadline must remain active after headers while the body is streaming",
  )

  globalThis.fetch = delayedJsonFetch(5)
  const payload = await fetchWithTotalTimeout(
    "https://example.test/stream",
    {},
    100,
    (response) => response.json(),
  )
  assert.deepEqual(payload, { ok: true })

  const callerController = new AbortController()
  callerController.abort(new DOMException("Cancelled by caller", "AbortError"))
  await assert.rejects(
    () => fetchWithTotalTimeout(
      "https://example.test/stream",
      { signal: callerController.signal },
      100,
      (response) => response.json(),
    ),
    /Cancelled by caller|AbortError/,
    "a signal cancelled before the helper starts must remain cancelled",
  )
} finally {
  globalThis.fetch = originalFetch
}

console.log("API TIMEOUT CONTRACT PASSED")
