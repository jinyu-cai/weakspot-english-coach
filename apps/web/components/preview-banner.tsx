"use client"

import { useLanguage } from "@/components/language-provider"

/** Quiet marker for the redesign preview branch. */
export function PreviewBanner() {
  const { t } = useLanguage()

  return (
    <div className="border-b border-border/60 bg-muted/40">
      <p className="px-3 py-1.5 text-center text-[11px] text-muted-foreground">
        {t.nav.previewBanner}
      </p>
    </div>
  )
}
