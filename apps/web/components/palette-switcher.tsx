"use client"

import { useEffect, useState } from "react"
import { PALETTES, getPalette, setPalette, type PaletteId } from "@/lib/palette"
import { cn } from "@/lib/utils"

export function PaletteSwitcher() {
  const [active, setActive] = useState<PaletteId>("cream")
  useEffect(() => setActive(getPalette()), [])

  return (
    <div className="hidden items-center gap-1 sm:flex" role="radiogroup" aria-label="Color theme">
      {PALETTES.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={active === p.id}
          aria-label={p.label}
          title={p.label}
          onClick={() => {
            setPalette(p.id)
            setActive(p.id)
          }}
          className={cn(
            "size-5 rounded-full border border-border/70 transition-transform",
            active === p.id
              ? "scale-110 ring-2 ring-foreground/40 ring-offset-1 ring-offset-background"
              : "hover:scale-110",
          )}
          style={{ backgroundColor: p.swatch }}
        />
      ))}
    </div>
  )
}
