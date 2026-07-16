"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/nav"
import { getMe } from "@/lib/auth"
import { useLanguage } from "@/components/language-provider"
import { LearningLoop } from "@/components/learning-loop"

export function NavSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [isOwner, setIsOwner] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    getMe().then((me) => setIsOwner(!!me.isOwner))
  }, [])

  const visibleItems = NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner)
  const activeHref = [...visibleItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)))
    ?.href

  const loopActive =
    pathname.startsWith("/practice") || pathname.startsWith("/plan") || pathname.startsWith("/chat")
      ? "practice"
      : pathname.startsWith("/memory") || pathname.startsWith("/notebook") || pathname.startsWith("/dashboard")
        ? "remember"
        : "discover"

  return (
    <div className="flex min-h-full flex-col gap-4 p-3.5">
      <Link
        href="/"
        onClick={onNavigate}
        className="group flex items-center gap-3 rounded-2xl px-2 py-1.5 outline-none transition focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-featured)] transition-transform group-hover:-rotate-3">
          <span className="text-xl" aria-hidden="true">
            🦉
          </span>
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-heading text-lg font-semibold tracking-tight text-sidebar-foreground">
            WeakSpot
          </span>
          <span className="text-[11px] text-muted-foreground">{t.nav.brandSubtitle}</span>
        </span>
      </Link>

      <div className="rounded-2xl border border-sidebar-border/80 bg-card/80 p-3 shadow-sm">
        <p className="mb-2 px-0.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {t.nav.loopTitle}
        </p>
        <LearningLoop
          compact
          activeKey={loopActive}
          steps={[
            { key: "discover", label: t.nav.loop.discover },
            { key: "practice", label: t.nav.loop.practice },
            { key: "remember", label: t.nav.loop.remember },
          ]}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t.nav.loopHint}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-4" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => {
          const items = group.items
            .map((key) => visibleItems.find((item) => item.key === key))
            .filter((item): item is (typeof visibleItems)[number] => Boolean(item))

          if (items.length === 0) return null

          return (
            <section key={group.key} aria-labelledby={`nav-group-${group.key}`}>
              <h2
                id={`nav-group-${group.key}`}
                className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/80 uppercase"
              >
                {t.nav.groups[group.key]}
              </h2>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const isActive = item.href === activeHref
                  const Icon = item.icon
                  const localized = t.nav.items[item.key]
                  const isPrimaryStart = group.key === "start" && item.key === "mission"
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/35",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-primary/15"
                          : "text-muted-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          isActive ? "bg-primary/15 text-primary" : "bg-muted/70 text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate">{localized[0]}</span>
                        {isActive || isPrimaryStart ? (
                          <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
                            {localized[1]}
                          </span>
                        ) : null}
                      </span>
                      {isPrimaryStart && !isActive ? (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          {t.nav.startHereShort}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </nav>

      <div className="rounded-2xl border border-sidebar-border bg-card/80 p-3 text-xs leading-relaxed text-muted-foreground shadow-sm">
        <p className="font-medium text-sidebar-foreground">{t.nav.coachTipTitle}</p>
        <p className="mt-1">{t.nav.tagline}</p>
      </div>
    </div>
  )
}
