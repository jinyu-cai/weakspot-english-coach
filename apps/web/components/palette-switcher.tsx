"use client"

import { useEffect, useState } from "react"
import { Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PALETTES, getPalette, setPalette, type PaletteId } from "@/lib/palette"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/language-provider"

export function PaletteSwitcher() {
  const [active, setActive] = useState<PaletteId>("cream")
  const { t } = useLanguage()
  useEffect(() => setActive(getPalette()), [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label={t.settings.colorTheme} title={t.settings.colorTheme}>
            <Palette />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="flex w-auto min-w-0 gap-1.5 p-1.5">
        {PALETTES.map((p) => (
          <DropdownMenuItem
            key={p.id}
            aria-label={p.label}
            title={p.label}
            onClick={() => {
              setPalette(p.id)
              setActive(p.id)
            }}
            className={cn(
              "flex size-11 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border p-0 transition-colors",
              active === p.id
                ? "border-foreground/50 ring-2 ring-foreground/25"
                : "border-border/60 hover:border-foreground/40",
            )}
            style={{ backgroundColor: p.bg }}
          >
            <span
              className="size-4 rounded-full shadow-sm"
              style={{ backgroundColor: p.primary }}
              aria-hidden
            />
            <span
              className="h-2 w-5 rounded-full"
              style={{ backgroundColor: p.accent }}
              aria-hidden
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
