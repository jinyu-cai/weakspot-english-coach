export type RealtimeTranscriptRole = "user" | "assistant"

export interface RealtimeTranscriptEntry {
  id: string
  role: RealtimeTranscriptRole
  text: string
  final: boolean
}

export interface RealtimeTranscriptState {
  entries: RealtimeTranscriptEntry[]
  assistantBuffers: Record<string, string>
  itemOrder: string[]
}

export interface RealtimeTranscriptEventResult {
  state: RealtimeTranscriptState
  assistantAudioStarted: boolean
  responseDone: boolean
}

const ASSISTANT_TRANSCRIPT_DELTA_EVENTS = new Set([
  "response.output_audio_transcript.delta",
  // Compatibility with Realtime sessions created before the current event names.
  "response.audio_transcript.delta",
])

const ASSISTANT_TRANSCRIPT_DONE_EVENTS = new Set([
  "response.output_audio_transcript.done",
  "response.audio_transcript.done",
])

const ASSISTANT_AUDIO_DELTA_EVENTS = new Set([
  "response.output_audio.delta",
  "response.audio.delta",
])

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function itemTranscriptId(role: RealtimeTranscriptRole, itemId: string) {
  return `${role}:${itemId}`
}

function transcriptEntryId(
  event: Record<string, unknown>,
  role: RealtimeTranscriptRole,
): string {
  for (const key of ["item_id", "response_id", "event_id"]) {
    const value = nonEmptyString(event[key])
    if (value) return itemTranscriptId(role, value)
  }
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  return itemTranscriptId(role, randomId)
}

function assistantBufferKey(event: Record<string, unknown>): string {
  return ["response_id", "item_id", "output_index", "content_index"]
    .map((key) => event[key])
    .filter((value) => value !== undefined && value !== null && String(value))
    .map(String)
    .join(":") || "assistant"
}

function orderedEntries(
  entries: RealtimeTranscriptEntry[],
  itemOrder: string[],
): RealtimeTranscriptEntry[] {
  const positions = new Map(itemOrder.map((id, index) => [id, index]))
  return entries
    .map((entry, arrivalIndex) => ({ entry, arrivalIndex }))
    .sort((left, right) => {
      const leftPosition = positions.get(left.entry.id)
      const rightPosition = positions.get(right.entry.id)
      if (leftPosition !== undefined && rightPosition !== undefined) {
        return leftPosition - rightPosition
      }
      if (leftPosition !== undefined) return -1
      if (rightPosition !== undefined) return 1
      return left.arrivalIndex - right.arrivalIndex
    })
    .map(({ entry }) => entry)
}

function registerItemOrder(state: RealtimeTranscriptState, id: string): RealtimeTranscriptState {
  if (state.itemOrder.includes(id)) return state
  const itemOrder = [...state.itemOrder, id]
  return {
    ...state,
    itemOrder,
    entries: orderedEntries(state.entries, itemOrder),
  }
}

function upsertEntry(
  state: RealtimeTranscriptState,
  entry: RealtimeTranscriptEntry,
): RealtimeTranscriptState {
  const existingIndex = state.entries.findIndex((candidate) => candidate.id === entry.id)
  const entries = existingIndex === -1
    ? [...state.entries, entry]
    : state.entries.map((candidate, index) => index === existingIndex ? entry : candidate)
  return {
    ...state,
    entries: orderedEntries(entries, state.itemOrder),
  }
}

function registerConversationItem(
  state: RealtimeTranscriptState,
  event: Record<string, unknown>,
): RealtimeTranscriptState {
  const item = record(event.item)
  const role = item?.role
  const itemId = nonEmptyString(item?.id)
  if ((role !== "user" && role !== "assistant") || !itemId) return state
  return registerItemOrder(state, itemTranscriptId(role, itemId))
}

function responseDoneAssistantEntries(
  event: Record<string, unknown>,
): RealtimeTranscriptEntry[] {
  const response = record(event.response)
  if (!response || !Array.isArray(response.output)) return []

  return response.output.flatMap((rawItem) => {
    const item = record(rawItem)
    if (!item || item.role !== "assistant" || !Array.isArray(item.content)) return []
    const itemId = nonEmptyString(item.id)
    if (!itemId) return []
    const transcript = item.content
      .map((rawPart) => nonEmptyString(record(rawPart)?.transcript))
      .filter((part): part is string => Boolean(part))
      .join(" ")
      .trim()
    if (!transcript) return []
    return [{
      id: itemTranscriptId("assistant", itemId),
      role: "assistant" as const,
      text: transcript,
      final: true,
    }]
  })
}

export function createRealtimeTranscriptState(
  entries: RealtimeTranscriptEntry[] = [],
): RealtimeTranscriptState {
  return {
    entries,
    assistantBuffers: {},
    itemOrder: entries.map((entry) => entry.id),
  }
}

export function applyRealtimeTranscriptEvent(
  previousState: RealtimeTranscriptState,
  event: Record<string, unknown>,
): RealtimeTranscriptEventResult {
  const type = typeof event.type === "string" ? event.type : ""
  let state = previousState

  if (type === "conversation.item.added" || type === "conversation.item.created") {
    state = registerConversationItem(state, event)
  }

  if (type === "conversation.item.input_audio_transcription.completed") {
    const text = nonEmptyString(event.transcript)
    if (text) {
      const entry = {
        id: transcriptEntryId(event, "user"),
        role: "user" as const,
        text,
        final: true,
      }
      state = registerItemOrder(state, entry.id)
      state = upsertEntry(state, entry)
    }
  }

  if (ASSISTANT_TRANSCRIPT_DELTA_EVENTS.has(type)) {
    const delta = typeof event.delta === "string" ? event.delta : ""
    if (delta) {
      const key = assistantBufferKey(event)
      const text = `${state.assistantBuffers[key] || ""}${delta}`
      state = {
        ...state,
        assistantBuffers: { ...state.assistantBuffers, [key]: text },
      }
      const entry = {
        id: transcriptEntryId(event, "assistant"),
        role: "assistant" as const,
        text,
        final: false,
      }
      state = registerItemOrder(state, entry.id)
      state = upsertEntry(state, entry)
    }
  }

  if (ASSISTANT_TRANSCRIPT_DONE_EVENTS.has(type)) {
    const key = assistantBufferKey(event)
    const text = nonEmptyString(event.transcript)
      || nonEmptyString(state.assistantBuffers[key])
    const assistantBuffers = { ...state.assistantBuffers }
    delete assistantBuffers[key]
    state = { ...state, assistantBuffers }
    if (text) {
      const entry = {
        id: transcriptEntryId(event, "assistant"),
        role: "assistant" as const,
        text,
        final: true,
      }
      state = registerItemOrder(state, entry.id)
      state = upsertEntry(state, entry)
    }
  }

  if (type === "response.done") {
    for (const entry of responseDoneAssistantEntries(event)) {
      state = registerItemOrder(state, entry.id)
      state = upsertEntry(state, entry)
    }
  }

  return {
    state,
    assistantAudioStarted: ASSISTANT_AUDIO_DELTA_EVENTS.has(type),
    responseDone: type === "response.done",
  }
}
