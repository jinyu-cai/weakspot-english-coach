import JSZip from "jszip"
import type { ChatImportConversation, ChatImportMessage } from "./types"

const CHAT_IMPORT_BATCH_MAX_BYTES = 200_000
const CHAT_IMPORT_BATCH_MAX_CONVERSATIONS = 20

type RawExportMessage = {
  id?: string
  author?: { role?: string }
  create_time?: number | null
  content?: {
    parts?: unknown[]
    text?: string
  }
}

type RawExportNode = {
  message?: RawExportMessage | null
}

type RawExportConversation = {
  id?: string
  title?: string
  create_time?: number
  update_time?: number
  mapping?: Record<string, RawExportNode>
  messages?: RawExportMessage[]
}

function textFromPart(part: unknown): string {
  if (typeof part === "string") return part
  if (!part || typeof part !== "object") return ""
  const obj = part as Record<string, unknown>
  if (typeof obj.text === "string") return obj.text
  if (typeof obj.content === "string") return obj.content
  return ""
}

function messageText(message: RawExportMessage): string {
  const content = message.content
  if (!content) return ""
  if (Array.isArray(content.parts)) return content.parts.map(textFromPart).filter(Boolean).join("\n").trim()
  if (typeof content.text === "string") return content.text.trim()
  return ""
}

function normalizeRole(role?: string): ChatImportMessage["role"] | null {
  if (role === "user") return "user"
  if (role === "assistant") return "assistant"
  return null
}

function isoFromTimestamp(value?: number | null): string | null {
  if (!value) return null
  return new Date(value * 1000).toISOString()
}

function normalizeConversation(raw: RawExportConversation, fallbackIndex: number): ChatImportConversation | null {
  const sourceMessages = raw.mapping
    ? Object.values(raw.mapping)
        .map((node) => node.message)
        .filter(Boolean)
        .sort((a, b) => (a?.create_time ?? 0) - (b?.create_time ?? 0))
    : raw.messages ?? []

  const messages = sourceMessages
    .map((message) => {
      if (!message) return null
      const role = normalizeRole(message.author?.role)
      const text = messageText(message)
      if (!role || !text) return null
      return { role, text, createdAt: isoFromTimestamp(message.create_time) }
    })
    .filter(Boolean) as ChatImportMessage[]

  if (!messages.some((msg) => msg.role === "user")) return null

  return {
    id: raw.id ?? `chat-${fallbackIndex}`,
    title: raw.title ?? `Conversation ${fallbackIndex + 1}`,
    messages,
  }
}

export function normalizeChatGPTExport(raw: unknown): ChatImportConversation[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { conversations?: unknown[] }).conversations)
      ? (raw as { conversations: unknown[] }).conversations
      : []

  return list
    .map((item, index) => normalizeConversation(item as RawExportConversation, index))
    .filter(Boolean) as ChatImportConversation[]
}

export function parseTranscript(text: string): ChatImportConversation[] {
  const lines = text.split(/\r?\n/)
  const messages: ChatImportMessage[] = []
  let currentRole: ChatImportMessage["role"] | null = null
  let buffer: string[] = []

  function flush() {
    const body = buffer.join("\n").trim()
    if (currentRole && body) messages.push({ role: currentRole, text: body })
    buffer = []
  }

  for (const line of lines) {
    const match = line.match(/^\s*(user|me|assistant|chatgpt|ai)\s*:\s*(.*)$/i)
    if (match) {
      flush()
      currentRole = /assistant|chatgpt|ai/i.test(match[1]) ? "assistant" : "user"
      buffer.push(match[2])
    } else {
      buffer.push(line)
    }
  }
  flush()

  if (!messages.length && text.trim()) messages.push({ role: "user", text: text.trim() })
  return [{ id: "pasted-transcript", title: "Pasted transcript", messages }]
}

export async function parseChatGPTImportFile(file: File): Promise<ChatImportConversation[]> {
  const lowerName = file.name.toLowerCase()
  let conversations: ChatImportConversation[]

  if (lowerName.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file)
    const bundled =
      zip.file("conversations.json") ??
      zip.file(/(^|\/)conversations\.json$/i)[0]

    if (bundled) {
      const raw = JSON.parse(await bundled.async("string"))
      conversations = normalizeChatGPTExport(raw)
    } else {
      // ChatGPT Exporter plugin: individual JSON files per conversation
      const jsonFiles = zip.file(/\.json$/i)
      if (!jsonFiles.length) throw new Error("No JSON files found inside the ZIP.")
      const parsed = await Promise.all(
        jsonFiles.map(async (entry, i) => {
          try {
            const raw = JSON.parse(await entry.async("string"))
            return normalizeConversation(raw as RawExportConversation, i)
          } catch {
            return null
          }
        }),
      )
      conversations = parsed.filter(Boolean) as ChatImportConversation[]
    }
  } else {
    const raw = JSON.parse(await file.text())
    conversations = Array.isArray(raw)
      ? normalizeChatGPTExport(raw)
      : [normalizeConversation(raw as RawExportConversation, 0)].filter(Boolean) as ChatImportConversation[]
  }

  if (!conversations.length) throw new Error("No analyzable user/assistant conversations were found.")
  return conversations
}

// Signals that a conversation is an English-practice chat (translation, correction,
// grammar help, etc.) — these are the highest-value imports to analyze.
const PRACTICE_SIGNAL =
  /\b(translate|translation|correct|grammar|english|rewrite|paraphrase|pronunc\w*|vocabulary|essay|writing|ielts|toefl)\b|翻译|纠错|改错|语法|改写|润色|英语|口语/i

function englishRatio(text: string): number {
  const letters = (text.match(/[a-zA-Z]/g) ?? []).length
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const total = letters + cjk
  return total === 0 ? 0 : letters / total
}

function conversationScore(conversation: ChatImportConversation): number {
  const userMessages = conversation.messages.filter((msg) => msg.role === "user")
  const userText = userMessages.map((msg) => msg.text).join(" ")
  const haystack = `${conversation.title ?? ""} ${conversation.messages.map((m) => m.text).join(" ")}`
  let score = Math.min(userMessages.length, 30) * 1.5 // substance: how much the user wrote
  if (PRACTICE_SIGNAL.test(haystack)) score += 40 // a dedicated English-practice project
  score += englishRatio(userText) * 25 // English-heavy chats are practice, not casual Q&A
  return score
}

// Rank by English-learning relevance (not just length) so dedicated practice
// projects — translation, correction — surface ahead of casual chats.
export function selectImportConversations(conversations: ChatImportConversation[], maxConversations = 12) {
  return conversations
    .filter((conversation) => conversation.messages.some((msg) => msg.role === "user"))
    .map((conversation) => ({ conversation, score: conversationScore(conversation) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxConversations)
    .map(({ conversation }) => ({
      ...conversation,
      messages: conversation.messages.slice(-80),
    }))
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function splitTextByUtf8Bytes(value: string, maxBytes: number): string[] {
  if (utf8Bytes(value) <= maxBytes) return [value]
  const chunks: string[] = []
  let current = ""
  let currentBytes = 0
  for (const character of value) {
    const characterBytes = utf8Bytes(character)
    if (current && currentBytes + characterBytes > maxBytes) {
      chunks.push(current)
      current = ""
      currentBytes = 0
    }
    current += character
    currentBytes += characterBytes
  }
  if (current) chunks.push(current)
  return chunks
}

function conversationPayloadBytes(conversations: ChatImportConversation[]): number {
  return utf8Bytes(JSON.stringify({ conversations }))
}

function conversationSegments(
  conversation: ChatImportConversation,
  maxBytes: number,
): ChatImportConversation[] {
  // Reserve enough room for JSON keys, conversation metadata, and the rest of
  // the request envelope before splitting a single unusually large message.
  const maxMessageBytes = Math.max(1_024, maxBytes - 4_096)
  const messages = conversation.messages.flatMap((message) =>
    splitTextByUtf8Bytes(message.text, maxMessageBytes).map((text) => ({ ...message, text })),
  )
  const base = {
    ...conversation,
    id: conversation.id?.slice(0, 240) ?? null,
    title: conversation.title?.slice(0, 500) ?? null,
  }
  const segments: ChatImportConversation[] = []
  let segmentMessages: ChatImportMessage[] = []

  for (const message of messages) {
    const candidate = { ...base, messages: [...segmentMessages, message] }
    if (segmentMessages.length && conversationPayloadBytes([candidate]) > maxBytes - 512) {
      segments.push({ ...base, messages: segmentMessages })
      segmentMessages = [message]
    } else {
      segmentMessages.push(message)
    }
  }
  if (segmentMessages.length) segments.push({ ...base, messages: segmentMessages })
  return segments.map((segment, index) => segments.length > 1
    ? {
        ...segment,
        id: segment.id ? `${segment.id}:part-${index + 1}` : `part-${index + 1}`,
        title: segment.title ? `${segment.title} (part ${index + 1}/${segments.length})` : segment.title,
      }
    : segment)
}

/**
 * Keep each request comfortably below common ingress limits using serialized
 * UTF-8 bytes, not JavaScript character count. Oversized conversations are
 * split only at message boundaries (or within one exceptional message).
 */
export function chunkChatImportConversations(
  conversations: ChatImportConversation[],
  maxBytes = CHAT_IMPORT_BATCH_MAX_BYTES,
): ChatImportConversation[][] {
  const segments = conversations.flatMap((conversation) => conversationSegments(conversation, maxBytes))
  const batches: ChatImportConversation[][] = []
  let batch: ChatImportConversation[] = []

  for (const segment of segments) {
    const candidate = [...batch, segment]
    if (
      batch.length
      && (
        candidate.length > CHAT_IMPORT_BATCH_MAX_CONVERSATIONS
        || conversationPayloadBytes(candidate) > maxBytes
      )
    ) {
      batches.push(batch)
      batch = [segment]
    } else {
      batch = candidate
    }
  }
  if (batch.length) batches.push(batch)
  return batches
}
