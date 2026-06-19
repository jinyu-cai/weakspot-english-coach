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

const emptySettings: LLMSettings = {
  apiKey: "",
  baseUrl: DEFAULT_OPENAI_BASE_URL,
  model: "",
}

export function LLMProviderSettings() {
  const [open, setOpen] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [settings, setSettings] = useState<LLMSettings>(emptySettings)

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
    }

    if (!next.apiKey && !next.model) {
      clearLLMSettings()
      setConfigured(false)
      setSettings(emptySettings)
      toast.success("Server default provider selected")
      setOpen(false)
      return
    }

    if (!next.apiKey || !next.model) {
      toast.error("API key and model are both required")
      return
    }

    saveLLMSettings(next)
    setConfigured(true)
    toast.success("Custom AI provider saved")
    setOpen(false)
  }

  function clear() {
    clearLLMSettings()
    setConfigured(false)
    setSettings(emptySettings)
    toast.success("Server default provider selected")
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="icon" aria-label="AI provider settings">
            <KeyRound />
          </Button>
        }
      />
      <SheetContent className="w-[min(100vw,28rem)]">
        <SheetHeader>
          <SheetTitle>AI Provider</SheetTitle>
          <SheetDescription>OpenAI-compatible provider for AI requests.</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Mode</span>
            <Badge variant={configured ? "default" : "secondary"}>
              {configured ? "Custom" : "Server default"}
            </Badge>
          </div>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Base URL
            <input
              value={settings.baseUrl}
              onChange={(event) => update("baseUrl", event.target.value)}
              placeholder={DEFAULT_OPENAI_BASE_URL}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Model
            <input
              value={settings.model}
              onChange={(event) => update("model", event.target.value)}
              placeholder="gpt-4o-mini"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            API key
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
            Clear
          </Button>
          <Button onClick={save}>
            <Save data-icon="inline-start" />
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
