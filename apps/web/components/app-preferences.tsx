"use client"

import { Check, Moon, Settings2, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { OutputLanguage } from "@/lib/language"
import { getPalette, PALETTES, setPalette, type PaletteId } from "@/lib/palette"

const LANGUAGES: OutputLanguage[] = ["en", "zh-CN"]

export function AppPreferences() {
  const { language, setLanguage, t } = useLanguage()
  const { resolvedTheme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [activePalette, setActivePalette] = useState<PaletteId>("cream")

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setActivePalette(getPalette())
    setOpen(nextOpen)
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" aria-label={t.settings.preferences} title={t.settings.preferences}>
            <Settings2 />
            <span className="hidden sm:inline">{t.settings.preferences}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72 rounded-2xl p-2">
        <DropdownMenuLabel className="px-2 py-1.5">{t.language.label}</DropdownMenuLabel>
        {LANGUAGES.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => setLanguage(option)}
            className="min-h-10 rounded-xl px-2.5 py-2"
          >
            <span>{option === "en" ? t.language.english : t.language.chinese}</span>
            {language === option ? <Check className="ml-auto text-primary" /> : null}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuLabel className="px-2 py-1.5">{t.settings.appearance}</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="min-h-10 rounded-xl px-2.5 py-2"
        >
          {resolvedTheme === "dark" ? <Moon /> : <Sun />}
          <span>{resolvedTheme === "dark" ? t.settings.darkModeLabel : t.settings.lightMode}</span>
          <span className="ml-auto text-xs text-muted-foreground">{t.settings.change}</span>
        </DropdownMenuItem>

        <div className="mt-1 grid grid-cols-4 gap-1.5 px-1" role="group" aria-label={t.settings.colorTheme}>
          {PALETTES.map((palette) => (
            <button
              key={palette.id}
              type="button"
              aria-label={t.settings.palettes[palette.id]}
              title={t.settings.palettes[palette.id]}
              aria-pressed={activePalette === palette.id}
              onClick={() => {
                setPalette(palette.id)
                setActivePalette(palette.id)
              }}
              className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background outline-none transition hover:border-primary/45 focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-primary aria-pressed:bg-accent/50"
            >
              <span className="flex items-center gap-1" aria-hidden="true">
                <span className="size-4 rounded-full shadow-sm" style={{ backgroundColor: palette.primary }} />
                <span className="size-2.5 rounded-full" style={{ backgroundColor: palette.accent }} />
              </span>
              <span className="max-w-full truncate px-1 text-[9px] text-muted-foreground">
                {t.settings.palettes[palette.id]}
              </span>
              {activePalette === palette.id ? (
                <span className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-2.5" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
