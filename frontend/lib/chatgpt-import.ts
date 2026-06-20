import JSZip from "jszip"
import type { ChatImportConversation, ChatImportMessage } from "./types"

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
  let text: string

  if (lowerName.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file)
    const entry =
      zip.file("conversations.json") ??
      zip.file(/(^|\/)conversations\.json$/i)[0]
    if (!entry) throw new Error("ZIP 里没有找到 conversations.json。")
    text = await entry.async("string")
  } else {
    text = await file.text()
  }

  const raw = JSON.parse(text)
  const conversations = normalizeChatGPTExport(raw)
  if (!conversations.length) throw new Error("没有找到可分析的 user/assistant 对话。")
  return conversations
}

export function selectImportConversations(conversations: ChatImportConversation[], maxConversations = 12) {
  return conversations
    .filter((conversation) => conversation.messages.some((msg) => msg.role === "user"))
    .sort((a, b) => b.messages.length - a.messages.length)
    .slice(0, maxConversations)
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.slice(-80),
    }))
}
