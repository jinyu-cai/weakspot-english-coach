/** Count whitespace-delimited English words while ignoring punctuation-only tokens. */
export function countWords(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0

  return trimmed
    .split(/\s+/u)
    .filter((token) => /[\p{L}\p{N}]/u.test(token))
    .length
}
