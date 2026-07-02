"use client"

import { useEffect, useState } from "react"
import { KeyRound, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  clearLLMSettings,
  DEFAULT_OPENAI_BASE_URL,
  hasCustomLLMSettings,
  loadLLMSettings,
  saveLLMSettings,
  type LLMSettings,
} from "@/lib/llm-settings"
import { useLanguage } from "@/components/language-provider"

const emptySettings: LLMSettings = {
  apiKey: "",
  baseUrl: DEFAULT_OPENAI_BASE_URL,
  model: "",
  fastModel: "",
}

export function LLMProviderSettings() {
  const [open, setOpen] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [settings, setSettings] = useState<LLMSettings>(emptySettings)
  const { t } = useLanguage()

  useEffect(() => {
    setSettings(loadLLMSettings())
    setConfigured(hasCustomLLMSettings())
  }, [open])

  function update<K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function save() {
    const next = {
      apiKey: settings.apiKey.trim(),
      baseUrl: (settings.baseUrl || DEFAULT_OPENAI_BASE_URL).trim(),
      model: settings.model.trim(),
      fastModel: settings.fastModel.trim(),
    }

    if (!next.apiKey && !next.model) {
      clearLLMSettings()
      setConfigured(false)
      setSettings(emptySettings)
      toast.success(t.settings.serverSelected)
      setOpen(false)
      return
    }

    if (!next.apiKey || !next.model) {
      toast.error(t.settings.required)
      return
    }

    saveLLMSettings(next)
    setConfigured(true)
    toast.success(t.settings.saved)
    setOpen(false)
  }

  function clear() {
    clearLLMSettings()
    setConfigured(false)
    setSettings(emptySettings)
    toast.success(t.settings.serverSelected)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="icon" aria-label={t.settings.aiProviderAria} title={t.settings.aiProviderAria}>
            <KeyRound />
          </Button>
        }
      />
      <SheetContent className="w-[min(100vw,28rem)]">
        <SheetHeader>
          <SheetTitle>{t.settings.aiProvider}</SheetTitle>
          <SheetDescription>{t.settings.aiDescription}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{t.settings.mode}</span>
            <Badge variant={configured ? "default" : "secondary"}>
              {configured ? t.settings.custom : t.settings.serverDefault}
            </Badge>
          </div>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            {t.settings.baseUrl}
            <input
              value={settings.baseUrl}
              onChange={(event) => update("baseUrl", event.target.value)}
              placeholder={DEFAULT_OPENAI_BASE_URL}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            {t.settings.deepModel}
            <input
              value={settings.model}
              onChange={(event) => update("model", event.target.value)}
              placeholder="deepseek-v4-pro"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            {t.settings.fastModel}
            <input
              value={settings.fastModel}
              onChange={(event) => update("fastModel", event.target.value)}
              placeholder="deepseek-v4-flash"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            {t.settings.apiKey}
            <input
              value={settings.apiKey}
              onChange={(event) => update("apiKey", event.target.value)}
              placeholder="sk-..."
              type="password"
              autoComplete="off"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
        </div>

        <SheetFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={clear}>
            <Trash2 data-icon="inline-start" />
            {t.common.clear}
          </Button>
          <Button onClick={save}>
            <Save data-icon="inline-start" />
            {t.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
