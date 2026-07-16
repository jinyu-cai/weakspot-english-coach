"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/nav"
import { getMe } from "@/lib/auth"
import { useLanguage } from "@/components/language-provider"

const PRIMARY_KEYS = ["mission", "diagnose", "chat", "practice"] as const

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

  const primaryItems = PRIMARY_KEYS
    .map((key) => visibleItems.find((item) => item.key === key))
    .filter((item): item is (typeof visibleItems)[number] => Boolean(item))

  const primaryKeySet = new Set<string>(PRIMARY_KEYS)

  return (
    <div className="flex min-h-full flex-col gap-6 p-3">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 outline-none transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-base" aria-hidden="true">
          🦉
        </span>
        <span className="min-w-0">
          <span className="block font-heading text-lg leading-none tracking-tight text-sidebar-foreground">
            WeakSpot
          </span>
          <span className="mt-1 block text-[11px] text-muted-foreground">{t.nav.brandSubtitle}</span>
        </span>
      </Link>

      {/* Primary actions: larger, clearer, always first */}
      <div>
        <p className="mb-2 px-2 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {t.nav.primaryTitle}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {primaryItems.map((item) => {
            const isActive = item.href === activeHref
            const Icon = item.icon
            const label = t.nav.items[item.key][0]
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-[4.25rem] flex-col items-start justify-between rounded-xl border px-2.5 py-2 outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40",
                  isActive
                    ? "border-primary/25 bg-primary/10 text-foreground"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", isActive ? "text-primary" : "opacity-70")} />
                <span className="text-[12px] font-medium leading-tight">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Everything else: compact list, less visual noise */}
      <nav className="flex flex-1 flex-col gap-4" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => {
          const items = group.items
            .map((key) => visibleItems.find((item) => item.key === key))
            .filter((item): item is (typeof visibleItems)[number] => Boolean(item))
            .filter((item) => !primaryKeySet.has(item.key))

          if (items.length === 0) return null

          return (
            <section key={group.key} aria-labelledby={`nav-group-${group.key}`}>
              <h2
                id={`nav-group-${group.key}`}
                className="mb-1 px-2 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase"
              >
                {t.nav.groups[group.key]}
              </h2>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const isActive = item.href === activeHref
                  const Icon = item.icon
                  const localized = t.nav.items[item.key]
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex h-8 items-center gap-2 rounded-lg px-2 text-[12.5px] outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40",
                        isActive
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{localized[0]}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </nav>
    </div>
  )
}
