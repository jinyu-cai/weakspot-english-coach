"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/nav"
import { getMe } from "@/lib/auth"
import { useLanguage } from "@/components/language-provider"

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

  return (
    <div className="flex min-h-full flex-col gap-5 p-3.5">
      <Link
        href="/"
        onClick={onNavigate}
        className="group flex items-center gap-3 rounded-2xl px-2 py-1.5 outline-none transition focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3">
          <span className="text-xl" aria-hidden="true">
            🦉
          </span>
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-heading text-lg font-semibold tracking-tight text-sidebar-foreground">
            WeakSpot
          </span>
          <span className="text-[11px] text-muted-foreground">English Coach</span>
        </span>
      </Link>

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
                className="mb-1 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/80 uppercase"
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
                        "group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/35",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/10"
                          : "text-muted-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className={cn("size-[18px] shrink-0", isActive && "text-primary")} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate">{localized[0]}</span>
                        {isActive ? (
                          <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
                            {localized[1]}
                          </span>
                        ) : null}
                      </span>
                      {item.key === "mission" && !isActive ? (
                        <span className="size-1.5 rounded-full bg-primary" aria-label={t.nav.startHere} />
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </nav>

      <div className="rounded-2xl border border-sidebar-border bg-card/70 p-3 text-xs leading-relaxed text-muted-foreground shadow-sm">
        {t.nav.tagline}
      </div>
    </div>
  )
}
