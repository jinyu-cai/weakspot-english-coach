"use client"

import { useState } from "react"
import { KeyRound, RefreshCw, Save, Trash2 } from "lucide-react"
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
  DEFAULT_SERVER_DEEP_MODEL_ID,
  DEFAULT_SERVER_FAST_MODEL_ID,
  DEFAULT_OPENAI_BASE_URL,
  formatServerModelSelection,
  hasCustomLLMSettings,
  loadLLMSettings,
  normalizeServerModelSettings,
  QWEN_37_MAX_MODEL,
  QWEN_37_PLUS_MODEL,
  QWEN_MODEL_STUDIO_INTERNATIONAL_BASE_URL,
  saveLLMSettings,
  serverModelsForMode,
  type LLMSettings,
  type ServerLLMModel,
} from "@/lib/llm-settings"
import { getServerLLMModels } from "@/lib/api-client"
import { useLanguage } from "@/components/language-provider"

const emptySettings: LLMSettings = {
  apiKey: "",
  baseUrl: DEFAULT_OPENAI_BASE_URL,
  model: "",
  fastModel: "",
  serverDeepModelId: DEFAULT_SERVER_DEEP_MODEL_ID,
  serverFastModelId: DEFAULT_SERVER_FAST_MODEL_ID,
}

export function LLMProviderSettings() {
  const [open, setOpen] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [settings, setSettings] = useState<LLMSettings>(emptySettings)
  const [serverModels, setServerModels] = useState<ServerLLMModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState(false)
  const { t } = useLanguage()

  const deepServerModels = serverModelsForMode(serverModels, "deep")
  const fastServerModels = serverModelsForMode(serverModels, "fast")
  const selectedDeepModel = deepServerModels.find((model) => model.id === settings.serverDeepModelId)
  const selectedFastModel = fastServerModels.find((model) => model.id === settings.serverFastModelId)
  const isQwenDefault = (
    settings.serverDeepModelId === DEFAULT_SERVER_DEEP_MODEL_ID
    && settings.serverFastModelId === DEFAULT_SERVER_FAST_MODEL_ID
  )

  async function loadServerModels() {
    setLoadingModels(true)
    setModelsError(false)
    try {
      const models = await getServerLLMModels()
      if (models.length === 0) throw new Error("No server models available.")
      setServerModels(models)
      setSettings((current) => normalizeServerModelSettings(current, models))
    } catch {
      setServerModels([])
      setModelsError(true)
    } finally {
      setLoadingModels(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSettings(loadLLMSettings())
      setConfigured(hasCustomLLMSettings())
      void loadServerModels()
    }
    setOpen(nextOpen)
  }

  function update<K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function applyQwenPreset() {
    setSettings((current) => ({
      ...current,
      baseUrl: QWEN_MODEL_STUDIO_INTERNATIONAL_BASE_URL,
      model: QWEN_37_MAX_MODEL,
      fastModel: QWEN_37_PLUS_MODEL,
    }))
  }

  function selectServerModel(mode: "deep" | "fast", serverModelId: string) {
    setSettings((current) => ({
      ...current,
      [mode === "deep" ? "serverDeepModelId" : "serverFastModelId"]: serverModelId,
      // Selecting a hosted model is an explicit move away from BYOK. Do not
      // leave browser-stored credentials silently overriding that choice.
      apiKey: "",
      model: "",
      fastModel: "",
    }))
    setConfigured(false)
  }

  function save() {
    const next = {
      apiKey: settings.apiKey.trim(),
      baseUrl: (settings.baseUrl || DEFAULT_OPENAI_BASE_URL).trim(),
      model: settings.model.trim(),
      fastModel: settings.fastModel.trim(),
      serverDeepModelId: settings.serverDeepModelId || DEFAULT_SERVER_DEEP_MODEL_ID,
      serverFastModelId: settings.serverFastModelId || DEFAULT_SERVER_FAST_MODEL_ID,
    }

    if (!next.apiKey && !next.model) {
      saveLLMSettings(next)
      setConfigured(false)
      toast.success(
        next.serverDeepModelId === DEFAULT_SERVER_DEEP_MODEL_ID
          && next.serverFastModelId === DEFAULT_SERVER_FAST_MODEL_ID
          ? t.settings.serverSelected
          : t.settings.serverModelSaved,
      )
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
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

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{t.settings.mode}</span>
            <Badge variant={configured ? "default" : "secondary"}>
              {configured
                ? t.settings.custom
                : isQwenDefault
                  ? t.settings.serverDefault
                  : `${selectedDeepModel?.provider || t.settings.serverDeep} / ${selectedFastModel?.provider || t.settings.serverFast}`}
            </Badge>
          </div>

          <div className="grid gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
            <div className="text-sm font-medium text-foreground">{t.settings.serverModel}</div>
            {loadingModels && serverModels.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-center text-xs text-muted-foreground">
                {t.settings.serverModelsLoading}
              </p>
            ) : (
              <div className="grid gap-3">
                <ServerModelSelect
                  label={t.settings.deepModel}
                  value={settings.serverDeepModelId}
                  models={deepServerModels}
                  disabled={loadingModels}
                  onChange={(value) => selectServerModel("deep", value)}
                />
                <ServerModelSelect
                  label={t.settings.fastModel}
                  value={settings.serverFastModelId}
                  models={fastServerModels}
                  disabled={loadingModels}
                  onChange={(value) => selectServerModel("fast", value)}
                />
              </div>
            )}
            {modelsError && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <span className="text-xs text-destructive">{t.settings.serverModelsFailed}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => void loadServerModels()}>
                  <RefreshCw data-icon="inline-start" />
                  {t.common.tryAgain}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t.settings.serverModelHint}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <div>
              <div className="text-sm font-medium text-foreground">{t.settings.qwenPreset}</div>
              <p className="text-xs text-muted-foreground">{t.settings.qwenPresetHint} {t.settings.customProviderHint}</p>
            </div>
            <Button type="button" variant="secondary" onClick={applyQwenPreset}>
              {t.settings.useQwenPreset}
            </Button>
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

function ServerModelSelect({
  label,
  value,
  models,
  disabled,
  onChange,
}: {
  label: string
  value: string
  models: ServerLLMModel[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  const selectedModel = models.find((model) => model.id === value)

  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        disabled={disabled || models.length === 0}
        onChange={(event) => onChange(event.target.value)}
        title={selectedModel ? formatServerModelSelection(selectedModel) : value}
        className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 pr-8 text-sm font-medium text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-60"
      >
        {models.length === 0 && <option value={value}>{value}</option>}
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {formatServerModelSelection(model)}
          </option>
        ))}
      </select>
    </label>
  )
}
