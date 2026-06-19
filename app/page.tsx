"use client"

import { useState } from "react"
import { toast } from "sonner"
import { diagnose } from "@/lib/api-client"
import { DEMO_USER_ID, SAMPLE_PARAGRAPH } from "@/lib/mock-data"
import type { DiagnosticResult } from "@/lib/types"
import { DiagnosticInput } from "@/components/diagnostic-input"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { DiagnosticLoading } from "@/components/loading-state"

export default function DiagnosePage() {
  const [text, setText] = useState(SAMPLE_PARAGRAPH)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagnosticResult | null>(null)

  async function handleAnalyze() {
    setLoading(true)
    setResult(null)
    try {
      const res = await diagnose(DEMO_USER_ID, text)
      setResult(res.diagnostic)
      toast.success("诊断完成", { description: "已生成你的英语弱点报告。" })
    } catch (error) {
      toast.error("分析失败", {
        description: error instanceof Error ? error.message : "请稍后重试。",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Adaptive diagnosis
        </span>
        <h1 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Discover what you need to practice
        </h1>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          {
            "Instead of asking what you want to practice, WeakSpot diagnoses your real English writing — verb tense, agreement, vocabulary, clarity and more — then builds an evolving weakness profile."
          }
        </p>
      </header>

      <DiagnosticInput value={text} onChange={setText} onAnalyze={handleAnalyze} loading={loading} />

      {loading && <DiagnosticLoading />}
      {!loading && result && <DiagnosticReport result={result} />}
    </div>
  )
}
