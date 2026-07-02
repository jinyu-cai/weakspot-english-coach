export type DiffOpType = "equal" | "insert" | "delete"

export interface DiffOp {
  type: DiffOpType
  value: string
}

/**
 * Splits text into diff tokens while preserving whitespace and punctuation so
 * the pieces can be re-joined back into the original string. Each token is a run
 * of whitespace, a word (letters/digits/apostrophes), or a run of punctuation.
 */
function tokenize(text: string): string[] {
  return text.match(/\s+|[\w']+|[^\s\w]+/g) ?? []
}

/**
 * Word-level diff between the original and corrected text, git-style.
 *
 * Runs a longest-common-subsequence (LCS) over word tokens and walks the DP
 * table back into an ordered list of ops: `delete` for tokens only in the
 * original, `insert` for tokens only in the corrected text, and `equal` for
 * tokens shared by both. Comparison is case-sensitive so fixes like
 * `english -> English` surface as changes.
 */
export function diffWords(original: string, corrected: string): DiffOp[] {
  const a = tokenize(original)
  const b = tokenize(corrected)
  const n = a.length
  const m = b.length

  // dp[i][j] = LCS length of a[i:] and b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  const push = (type: DiffOpType, value: string) => {
    const last = ops[ops.length - 1]
    if (last && last.type === type) {
      last.value += value
    } else {
      ops.push({ type, value })
    }
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", a[i])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("delete", a[i])
      i++
    } else {
      push("insert", b[j])
      j++
    }
  }
  while (i < n) push("delete", a[i++])
  while (j < m) push("insert", b[j++])

  return ops
}
