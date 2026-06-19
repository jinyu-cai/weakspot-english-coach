"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Compass } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { DiagnosticInput } from "@/components/diagnostic-input"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { DiagnosticLoading } from "@/components/loading-state"
import { Button } from "@/components/ui/button"
import { diagnose } from "@/lib/api-client"
import { SAMPLE_PARAGRAPH } from "@/lib/mock-data"
import type { DiagnosticResult } from "@/lib/types"

export default function DiagnosePage() {
  const [text, setText] = useState(SAMPLE_PARAGRAPH)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagnosticResult | null>(null)

  async function handleAnalyze() {
    setLoading(true)
    setResult(null)
    try {
      const res = await diagnose(text)
      setResult(res.diagnostic)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        {/* Hero */}
        <section className="flex flex-col gap-3">
          <div className="flex w-fit items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <Compass className="size-3.5" />
            Adaptive English Coach
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Discover what you need to practice
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
            Instead of asking what you want to practice, WeakSpot diagnoses your real writing,
            finds specific weaknesses, and turns your mistakes into a personalized plan.
          </p>
        </section>

        <DiagnosticInput
          value={text}
          onChange={setText}
          onSubmit={handleAnalyze}
          loading={loading}
        />

        {loading && <DiagnosticLoading />}

        {!loading && result && (
          <>
            <DiagnosticReport result={result} />
            <div className="flex flex-wrap gap-3">
              <Button nativeButton={false} render={<Link href="/plan" />}>
                Generate a 7-day plan
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button nativeButton={false} variant="outline" render={<Link href="/dashboard" />}>
                View weakness profile
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
