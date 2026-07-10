"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"

const subscribe = () => () => {}
const getClientMounted = () => true
const getServerMounted = () => false

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribe, getClientMounted, getServerMounted)
  const { t } = useLanguage()

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={t.settings.darkMode}
      title={t.settings.darkMode}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? <Moon /> : <Sun />}
    </Button>
  )
}
