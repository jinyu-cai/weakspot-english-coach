"use client"

import { useLanguage } from "@/components/language-provider"

/** Quiet marker for the redesign preview branch. */
export function PreviewBanner() {
  const { t } = useLanguage()

  return (
    <div className="border-b border-hermes/20 bg-hermes text-white">
      <p className="px-3 py-1.5 text-center text-[11px] font-medium tracking-wide">
        {t.nav.previewBanner}
      </p>
    </div>
  )
}
