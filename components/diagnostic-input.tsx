"use client"

import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"

export function DiagnosticInput({
  value,
  onChange,
  onAnalyze,
  loading,
}: {
  value: string
  onChange: (value: string) => void
  onAnalyze: () => void
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <label htmlFor="diagnose-input" className="sr-only">
          Your English writing
        </label>
        <Textarea
          id="diagnose-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write or paste a paragraph in English. The coach will diagnose your specific weaknesses..."
          rows={7}
          disabled={loading}
          className="resize-none text-base leading-relaxed"
        />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{value.trim().length} characters</span>
        <Button onClick={onAnalyze} disabled={loading || value.trim().length < 10} size="lg">
          {loading ? <Spinner /> : <Sparkles data-icon="inline-start" />}
          {loading ? "Analyzing..." : "Analyze My English"}
        </Button>
      </CardFooter>
    </Card>
  )
}
