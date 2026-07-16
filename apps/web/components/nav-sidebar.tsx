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
    <div className="flex min-h-full flex-col gap-7 p-4">
      <Link
        href="/"
        onClick={onNavigate}
        className="group flex items-center gap-3 rounded-lg px-1 py-1 outline-none transition focus-visible:ring-2 focus-visible:ring-hermes/50"
      >
        <span className="hermes-mark transition-transform group-hover:-rotate-6">W</span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-heading text-[1.35rem] tracking-tight text-sidebar-foreground">
            WeakSpot
          </span>
          <span className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            English Coach
          </span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-5" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => {
          const items = group.items
            .map((key) => visibleItems.find((item) => item.key === key))
            .filter((item): item is (typeof visibleItems)[number] => Boolean(item))

          if (items.length === 0) return null

          return (
            <section key={group.key} aria-labelledby={`nav-group-${group.key}`}>
              <h2
                id={`nav-group-${group.key}`}
                className="mb-1.5 px-2.5 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase"
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
                        "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-hermes/40",
                        isActive
                          ? "bg-hermes font-medium text-white shadow-[0_0_0_1px_color-mix(in_srgb,#0000f2_40%,transparent)]"
                          : "text-muted-foreground hover:bg-hermes/8 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", isActive ? "opacity-100" : "opacity-70")} />
                      <span className="truncate">{localized[0]}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </nav>

      <div className="rounded-md border border-hermes/20 bg-hermes/5 px-3 py-2.5">
        <p className="font-heading text-sm text-foreground">{t.nav.coachTipTitle}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t.nav.tagline}</p>
      </div>
    </div>
  )
}
