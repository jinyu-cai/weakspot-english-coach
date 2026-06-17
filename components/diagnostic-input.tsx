"use client"

import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"

export function DiagnosticInput({
  value,
  onChange,
  onSubmit,
  loading,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  loading: boolean
}) {
  const charCount = value.length
  const tooShort = charCount < 10

  return (
    <Card>
      <CardContent className="pt-6">
        <label htmlFor="diagnose-input" className="mb-2 block text-sm font-medium">
          写下一段英文 Write some English
        </label>
        <Textarea
          id="diagnose-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write or paste a paragraph in English..."
          className="min-h-44 resize-y text-base leading-relaxed"
          disabled={loading}
        />
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-4">
        <span className="text-xs tabular-nums text-muted-foreground">{charCount} characters</span>
        <Button onClick={onSubmit} disabled={loading || tooShort}>
          {loading ? (
            <>
              <Spinner data-icon="inline-start" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles data-icon="inline-start" />
              Analyze My English
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
