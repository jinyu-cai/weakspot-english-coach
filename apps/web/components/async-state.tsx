"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { trackExperience } from "@/lib/experience"
import { useLanguage } from "@/components/language-provider"

export function useLoadingTimeout(loading: boolean, delayMs = 8_000) {
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (!loading) {
      const reset = window.setTimeout(() => setTimedOut(false), 0)
      return () => window.clearTimeout(reset)
    }
    const timer = window.setTimeout(() => setTimedOut(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, loading])
  return timedOut
}

export function AsyncErrorState({
  feature,
  error,
  timedOut = false,
  onRetry,
  compact = false,
}: {
  feature: string
  error?: unknown
  timedOut?: boolean
  onRetry: () => unknown | Promise<unknown>
  compact?: boolean
}) {
  const [retrying, setRetrying] = useState(false)
  const { language } = useLanguage()
  const zh = language === "zh-CN"
  const offline = typeof navigator !== "undefined" && !navigator.onLine
  const title = offline
    ? (zh ? "当前似乎处于离线状态" : "You appear to be offline")
    : timedOut
      ? (zh ? "加载时间比预期更长" : "This is taking longer than expected")
      : (zh ? "暂时无法加载这部分内容" : "We couldn’t load this section")
  const description = offline
    ? (zh ? "当前学习内容已保存在本设备。恢复网络后即可重试。" : "Your current work is kept on this device. Reconnect, then try again.")
    : timedOut
      ? (zh ? "当前内容不会丢失。你可以再等一下，或在这里重试。" : "Your current work is safe. You can wait a little longer or retry here.")
      : error instanceof Error && error.message
        ? error.message
        : (zh ? "当前内容仍然保留，可以再次请求。" : "Your current work is still here. Try the request again.")

  useEffect(() => {
    trackExperience("loading_failed", {
      feature,
      reason: offline ? "offline" : timedOut ? "timeout" : "request",
    })
  }, [feature, offline, timedOut])

  async function retry() {
    setRetrying(true)
    try {
      const succeeded = await onRetry()
      if (succeeded !== false) trackExperience("retry_succeeded", { feature })
    } finally {
      setRetrying(false)
    }
  }

  const content = (
    <div className={compact ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" : "flex flex-col items-center gap-4 py-4 text-center"}>
      <div className={compact ? "flex min-w-0 items-start gap-3" : "flex flex-col items-center gap-2"}>
        {offline ? <WifiOff className="size-5 shrink-0 text-warning" /> : <AlertTriangle className="size-5 shrink-0 text-warning" />}
        <div className={compact ? "min-w-0" : ""}>
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void retry()} disabled={retrying}>
        <RefreshCw className={retrying ? "animate-spin" : ""} data-icon="inline-start" />
        {retrying ? (zh ? "重试中…" : "Retrying…") : (zh ? "重试" : "Try again")}
      </Button>
    </div>
  )

  if (compact) return <div className="rounded-xl border border-warning/30 bg-warning/8 px-4 py-3">{content}</div>
  return <Card className="border-warning/30"><CardContent>{content}</CardContent></Card>
}
