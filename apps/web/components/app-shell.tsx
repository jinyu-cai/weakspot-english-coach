"use client"

import { useEffect, useRef, useState } from "react"
import { Menu } from "lucide-react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AuthButton } from "@/components/auth-button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { LLMProviderSettings } from "@/components/llm-provider-settings"
import { NavSidebar } from "@/components/nav-sidebar"
import { AppPreferences } from "@/components/app-preferences"
import { useLanguage } from "@/components/language-provider"
import { NAV_ITEMS } from "@/lib/nav"
import {
  isVoiceNavigationLocked,
  VOICE_NAVIGATION_LOCK_EVENT,
} from "@/lib/voice-navigation-guard"

const HISTORY_POSITION_KEY = "__weakspotHistoryPosition"

interface VoiceHistoryGuard {
  url: string
  position: number | null
  navigationIndex: number | null
}

interface HistoryPositionMarker {
  position: number
  url: string
}

interface NavigationEntryLike {
  index: number
}

interface NavigationApiLike extends EventTarget {
  currentEntry?: NavigationEntryLike | null
}

interface NavigateEventLike extends Event {
  navigationType?: string
}

function historyStateSnapshot(): Record<string, unknown> {
  const state = window.history.state
  return state && typeof state === "object" ? { ...state } : {}
}

function historyUrlKey() {
  return `${window.location.pathname}${window.location.search}`
}

function historyPosition(state: Record<string, unknown>, url: string): number | null {
  const marker = state[HISTORY_POSITION_KEY]
  if (!marker || typeof marker !== "object") return null
  const candidate = marker as Partial<HistoryPositionMarker>
  return candidate.url === url && Number.isInteger(candidate.position)
    ? candidate.position as number
    : null
}

function navigationApi(): NavigationApiLike | null {
  return ((window as typeof window & { navigation?: NavigationApiLike }).navigation ?? null)
}

function navigationIndex(): number | null {
  const index = navigationApi()?.currentEntry?.index
  return typeof index === "number" && Number.isInteger(index) ? index : null
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { t } = useLanguage()
  const activeNavItem = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))
  const voiceHistoryGuardRef = useRef<VoiceHistoryGuard | null>(null)
  const historyTrackerRef = useRef({ initialized: false, position: 0 })
  const restoringHistoryRef = useRef(false)

  // Tag each in-app history entry with a relative position. replaceState keeps
  // the browser's Back/Forward stack intact; the URL guards against Next.js
  // copying the previous entry's state into a newly pushed route.
  useEffect(() => {
    const state = historyStateSnapshot()
    const url = historyUrlKey()
    const existingPosition = historyPosition(state, url)
    const position = existingPosition ?? (
      historyTrackerRef.current.initialized
        ? historyTrackerRef.current.position + 1
        : 0
    )
    if (existingPosition === null) {
      window.history.replaceState(
        {
          ...state,
          [HISTORY_POSITION_KEY]: { position, url } satisfies HistoryPositionMarker,
        },
        "",
        window.location.href,
      )
    }
    historyTrackerRef.current = { initialized: true, position }
  }, [pathname])

  useEffect(() => {
    const warn = () => toast.error(t.chat.voicePanel.finishBeforeLeaving)
    const armHistoryGuard = () => {
      if (voiceHistoryGuardRef.current) return
      const state = historyStateSnapshot()
      const position = historyPosition(state, historyUrlKey())
        ?? (historyTrackerRef.current.initialized ? historyTrackerRef.current.position : null)
      voiceHistoryGuardRef.current = {
        url: window.location.href,
        position,
        navigationIndex: navigationIndex(),
      }
    }
    const disarmHistoryGuard = () => {
      voiceHistoryGuardRef.current = null
      restoringHistoryRef.current = false
    }
    const syncHistoryGuard = (locked: boolean) => {
      if (locked) armHistoryGuard()
      else disarmHistoryGuard()
    }
    const blockLinkNavigation = (event: MouseEvent) => {
      if (!isVoiceNavigationLocked() || event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest<HTMLAnchorElement>("a[href]")
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return
      const destination = new URL(anchor.href, window.location.href)
      const current = new URL(window.location.href)
      if (
        destination.origin === current.origin
        && destination.pathname === current.pathname
        && destination.search === current.search
      ) return

      event.preventDefault()
      event.stopPropagation()
      warn()
    }

    const blockCancelableTraversal = (event: Event) => {
      const navigateEvent = event as NavigateEventLike
      if (
        !isVoiceNavigationLocked()
        || restoringHistoryRef.current
        || navigateEvent.navigationType !== "traverse"
        || !event.cancelable
      ) return
      event.preventDefault()
      warn()
    }

    const blockHistoryNavigation = (event: PopStateEvent) => {
      const state = event.state && typeof event.state === "object"
        ? event.state as Record<string, unknown>
        : {}
      const targetPosition = historyPosition(state, historyUrlKey())

      if (restoringHistoryRef.current) {
        restoringHistoryRef.current = false
        if (targetPosition !== null) {
          historyTrackerRef.current = { initialized: true, position: targetPosition }
        }
        return
      }
      if (!isVoiceNavigationLocked()) {
        if (targetPosition !== null) {
          historyTrackerRef.current = { initialized: true, position: targetPosition }
        }
        return
      }
      const guard = voiceHistoryGuardRef.current
      if (!guard) {
        armHistoryGuard()
        warn()
        return
      }
      event.stopImmediatePropagation()

      const currentNavigationIndex = navigationIndex()
      const restoreDelta = guard.navigationIndex !== null && currentNavigationIndex !== null
        ? guard.navigationIndex - currentNavigationIndex
        : guard.position !== null && targetPosition !== null
          ? guard.position - targetPosition
          : null

      if (restoreDelta && Number.isInteger(restoreDelta)) {
        restoringHistoryRef.current = true
        window.history.go(restoreDelta)
      } else if (window.location.href !== guard.url) {
        // Old browsers without the Navigation API still have position markers
        // for routes visited during this app session. An unmarked traversal is
        // normally a Back action into an older entry; beforeunload protects any
        // cross-document traversal.
        restoringHistoryRef.current = true
        window.history.forward()
      }
      warn()
    }
    const handleVoiceLockChange = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { locked?: boolean } | undefined
        : undefined
      syncHistoryGuard(detail?.locked === true)
    }

    document.addEventListener("click", blockLinkNavigation, true)
    navigationApi()?.addEventListener("navigate", blockCancelableTraversal)
    window.addEventListener("popstate", blockHistoryNavigation, true)
    window.addEventListener(VOICE_NAVIGATION_LOCK_EVENT, handleVoiceLockChange)
    syncHistoryGuard(isVoiceNavigationLocked())
    return () => {
      document.removeEventListener("click", blockLinkNavigation, true)
      navigationApi()?.removeEventListener("navigate", blockCancelableTraversal)
      window.removeEventListener("popstate", blockHistoryNavigation, true)
      window.removeEventListener(VOICE_NAVIGATION_LOCK_EVENT, handleVoiceLockChange)
    }
  }, [t.chat.voicePanel.finishBeforeLeaving])

  if (pathname === "/login") return children

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-[17rem] overflow-y-auto border-r border-sidebar-border bg-sidebar/95 lg:block">
        <NavSidebar />
      </aside>

      <div className="flex min-w-0 w-full flex-col lg:pl-[17rem]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-border/80 bg-background/88 px-3 py-2 backdrop-blur-xl sm:px-5 lg:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                    <Menu />
                  </Button>
                }
              />
              <SheetContent side="left" className="w-72 overflow-y-auto bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <NavSidebar onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="truncate font-heading text-sm font-semibold text-foreground sm:text-base">
                {activeNavItem ? t.nav.items[activeNavItem.key][0] : "WeakSpot"}
              </p>
              {activeNavItem ? (
                <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                  {t.nav.items[activeNavItem.key][1]}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            <LLMProviderSettings />
            <AuthButton />
            <AppPreferences />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:px-10">{children}</main>
      </div>
    </div>
  )
}
