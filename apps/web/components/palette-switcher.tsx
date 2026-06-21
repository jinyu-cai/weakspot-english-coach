"use client"

import { useEffect, useState } from "react"
import { Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PALETTES, getPalette, setPalette, type PaletteId } from "@/lib/palette"

export function PaletteSwitcher() {
  const [active, setActive] = useState<PaletteId>("cream")
  useEffect(() => setActive(getPalette()), [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Color theme">
            <Palette />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>Color theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={active}
          onValueChange={(value) => {
            const id = value as PaletteId
            setPalette(id)
            setActive(id)
          }}
        >
          {PALETTES.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id}>
              <span
                className="size-4 shrink-0 rounded-full border border-border/70"
                style={{ backgroundColor: p.swatch }}
                aria-hidden
              />
              {p.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
