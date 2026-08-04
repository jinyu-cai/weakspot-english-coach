import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import ts from "typescript"

const sourcePath = fileURLToPath(new URL("../lib/chatgpt-import.ts", import.meta.url))
const sourceText = readFileSync(sourcePath, "utf8")
const backendRoutePath = fileURLToPath(
  new URL("../../api/app/api/routes/chat_import.py", import.meta.url),
)
const backendRouteText = readFileSync(backendRoutePath, "utf8")
const backendMessageLimit = Number(
  backendRouteText.match(/^PLATFORM_IMPORT_MESSAGE_LIMIT = (\d+)$/m)?.[1],
)
const backendConversationLimit = Number(
  backendRouteText.match(/^PLATFORM_IMPORT_CONVERSATION_LIMIT = (\d+)$/m)?.[1],
)
assert.ok(Number.isInteger(backendMessageLimit) && backendMessageLimit > 0)
assert.ok(Number.isInteger(backendConversationLimit) && backendConversationLimit > 0)

const transpiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
}).outputText

// The batching functions do not use JSZip. Replace that browser/file-parser
// dependency so this small contract test can execute the real module logic in
// Node without adding another test runner.
const executable = transpiled.replace(
  /^import JSZip from "jszip";$/m,
  "const JSZip = {};",
)
const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`
const { chunkChatImportConversations } = await import(moduleUrl)

const messages = Array.from({ length: backendMessageLimit * 2 + 1 }, (_, index) => ({
  role: index % 2 === 0 ? "user" : "assistant",
  text: `message-${index}`,
}))
const longConversationBatches = chunkChatImportConversations([{
  id: "long-conversation",
  title: "Long conversation",
  messages,
}])
const longConversationSegments = longConversationBatches.flat()

assert.deepEqual(
  longConversationSegments.map((conversation) => conversation.messages.length),
  [backendMessageLimit, backendMessageLimit, 1],
  "a long conversation must be split at the backend's ordinary-tier message limit",
)
assert.deepEqual(
  longConversationSegments.flatMap((conversation) => conversation.messages.map((message) => message.text)),
  messages.map((message) => message.text),
  "message splitting must preserve every message in order",
)

const manyConversations = Array.from(
  { length: backendConversationLimit * 2 + 5 },
  (_, index) => ({
    id: `conversation-${index}`,
    title: `Conversation ${index}`,
    messages: [{ role: "user", text: `hello-${index}` }],
  }),
)
const conversationLimitedBatches = chunkChatImportConversations(manyConversations)
assert.deepEqual(
  conversationLimitedBatches.map((batch) => batch.length),
  [backendConversationLimit, backendConversationLimit, 5],
  "the frontend conversation batches must match the backend's ordinary-tier limit",
)

const byteLimit = 12_000
const unicodeText = "你".repeat(12_000)
const byteLimitedBatches = chunkChatImportConversations([{
  id: "unicode-conversation",
  title: "UTF-8 byte limit",
  messages: [{ role: "user", text: unicodeText }],
}], byteLimit)
for (const batch of byteLimitedBatches) {
  const bytes = new TextEncoder().encode(JSON.stringify({ conversations: batch })).byteLength
  assert.ok(bytes <= byteLimit, `serialized batch exceeded ${byteLimit} bytes: ${bytes}`)
}
assert.equal(
  byteLimitedBatches
    .flatMap((batch) => batch)
    .flatMap((conversation) => conversation.messages)
    .map((message) => message.text)
    .join(""),
  unicodeText,
  "UTF-8 byte splitting must preserve the complete message text",
)

console.log("CHAT IMPORT BATCHING CONTRACT PASSED")
