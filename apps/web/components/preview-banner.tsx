"use client"

import { FlaskConical } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

/** Always-visible marker so reviewers know this is the redesign preview branch. */
export function PreviewBanner() {
  const { t } = useLanguage()

  return (
    <div className="relative z-40 border-b border-amber-500/30 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 text-stone-900">
      <div className="flex min-h-10 items-center justify-center gap-2 px-3 py-2 text-center text-xs font-semibold tracking-wide sm:text-sm">
        <FlaskConical className="size-4 shrink-0" aria-hidden="true" />
        <span>{t.nav.previewBanner}</span>
      </div>
    </div>
  )
}
