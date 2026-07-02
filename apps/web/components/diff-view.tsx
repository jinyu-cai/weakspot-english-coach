import { useMemo, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { diffWords, type DiffOp } from "@/lib/word-diff"

const isWhitespace = (value: string) => value.trim().length === 0

/**
 * Renders one side of the diff. `side="original"` keeps `equal` + `delete`
 * tokens (removed words highlighted red); `side="corrected"` keeps `equal` +
 * `insert` tokens (added words highlighted green). Whitespace-only changed
 * tokens are rendered plain so bare spaces never get a highlight.
 */
function DiffLine({ ops, side }: { ops: DiffOp[]; side: "original" | "corrected" }) {
  const changedType = side === "original" ? "delete" : "insert"
  const nodes: ReactNode[] = []

  ops.forEach((op, index) => {
    if (op.type === "equal") {
      nodes.push(<span key={index}>{op.value}</span>)
      return
    }
    if (op.type !== changedType) return // skip the other side's changes
    if (isWhitespace(op.value)) {
      nodes.push(<span key={index}>{op.value}</span>)
      return
    }
    nodes.push(
      <span
        key={index}
        className={cn(
          "rounded px-0.5",
          side === "original"
            ? "bg-danger/10 text-danger line-through decoration-danger/50"
            : "bg-success/15 text-success",
        )}
      >
        {op.value}
      </span>,
    )
  })

  return <span className="whitespace-pre-wrap">{nodes}</span>
}

/**
 * Git-style stacked before/after word diff between the learner's original
 * sentence and the polished rewrite.
 */
export function DiffView({ original, corrected }: { original: string; corrected: string }) {
  const ops = useMemo(() => diffWords(original, corrected), [original, corrected])

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-4 text-sm leading-relaxed">
      <div className="flex gap-3">
        <span className="select-none font-mono text-danger" aria-hidden>
          −
        </span>
        <DiffLine ops={ops} side="original" />
      </div>
      <div className="flex gap-3">
        <span className="select-none font-mono text-success" aria-hidden>
          +
        </span>
        <DiffLine ops={ops} side="corrected" />
      </div>
    </div>
  )
}
