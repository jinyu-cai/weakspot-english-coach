import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import ts from "typescript"

const sourcePath = fileURLToPath(new URL("../lib/realtime-transcript.ts", import.meta.url))
const sourceText = readFileSync(sourcePath, "utf8")
const transpiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
}).outputText
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
const { applyRealtimeTranscriptEvent, createRealtimeTranscriptState } = await import(moduleUrl)

function apply(state, event) {
  return applyRealtimeTranscriptEvent(state, event).state
}

let state = createRealtimeTranscriptState()
state = apply(state, {
  type: "conversation.item.added",
  item: { id: "user_1", type: "message", role: "user", content: [] },
})
state = apply(state, {
  type: "conversation.item.added",
  item: { id: "assistant_1", type: "message", role: "assistant", content: [] },
})

// Output transcript events may beat the asynchronous user transcription.
state = apply(state, {
  type: "response.output_audio_transcript.delta",
  response_id: "response_1",
  item_id: "assistant_1",
  output_index: 0,
  content_index: 0,
  delta: "Thanks for ",
})
assert.deepEqual(state.entries.map((entry) => [entry.role, entry.text, entry.final]), [
  ["assistant", "Thanks for ", false],
])
state = apply(state, {
  type: "conversation.item.input_audio_transcription.completed",
  item_id: "user_1",
  transcript: "I need some help.",
})
assert.deepEqual(
  state.entries.map((entry) => entry.role),
  ["user", "assistant"],
  "conversation item order must win over asynchronous transcription arrival order",
)
state = apply(state, {
  type: "response.output_audio_transcript.delta",
  response_id: "response_1",
  item_id: "assistant_1",
  output_index: 0,
  content_index: 0,
  delta: "explaining that.",
})
state = apply(state, {
  type: "response.output_audio_transcript.done",
  response_id: "response_1",
  item_id: "assistant_1",
  output_index: 0,
  content_index: 0,
  transcript: "Thanks for explaining that.",
})
assert.deepEqual(state.entries[1], {
  id: "assistant:assistant_1",
  role: "assistant",
  text: "Thanks for explaining that.",
  final: true,
})

// response.done is a lossless fallback and must update, not duplicate, the turn.
state = apply(state, {
  type: "response.done",
  response: {
    id: "response_1",
    output: [{
      id: "assistant_1",
      type: "message",
      role: "assistant",
      content: [{ type: "output_audio", transcript: "Thanks for explaining that." }],
    }],
  },
})
assert.equal(state.entries.length, 2)

let fallbackState = createRealtimeTranscriptState()
fallbackState = apply(fallbackState, {
  type: "response.done",
  response: {
    output: [{
      id: "assistant_fallback",
      type: "message",
      role: "assistant",
      content: [{ type: "output_audio", transcript: "This came from response.done." }],
    }],
  },
})
assert.deepEqual(fallbackState.entries.map((entry) => entry.text), [
  "This came from response.done.",
])

// Keep compatibility with older Realtime event names during rollout.
let legacyState = createRealtimeTranscriptState()
legacyState = apply(legacyState, {
  type: "response.audio_transcript.delta",
  item_id: "legacy_assistant",
  delta: "Legacy ",
})
legacyState = apply(legacyState, {
  type: "response.audio_transcript.done",
  item_id: "legacy_assistant",
  transcript: "Legacy transcript.",
})
assert.equal(legacyState.entries[0].text, "Legacy transcript.")
assert.equal(legacyState.entries[0].final, true)

const audioEvent = applyRealtimeTranscriptEvent(createRealtimeTranscriptState(), {
  type: "response.output_audio.delta",
  delta: "base64-audio",
})
assert.equal(audioEvent.assistantAudioStarted, true)

console.log("REALTIME AI TRANSCRIPT CONTRACT PASSED")
