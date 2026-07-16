"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/nav"
import { getMe } from "@/lib/auth"
import { useLanguage } from "@/components/language-provider"

const PRIMARY_KEYS = new Set(["mission", "diagnose", "chat", "practice"])

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

  const primaryItems = ["mission", "diagnose", "chat", "practice"]
    .map((key) => visibleItems.find((item) => item.key === key))
    .filter((item): item is (typeof visibleItems)[number] => Boolean(item))

  return (
    <div className="flex min-h-full flex-col gap-5 bg-[oklch(0.24_0.05_230)] p-3.5 text-white">
      <Link
        href="/"
        onClick={onNavigate}
        className="group flex items-center gap-3 rounded-2xl px-2 py-1.5 outline-none transition focus-visible:ring-3 focus-visible:ring-white/30"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-[oklch(0.82_0.14_75)] text-2xl text-stone-900 shadow-lg transition-transform group-hover:-rotate-6">
          <span aria-hidden="true">🦉</span>
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-heading text-lg font-semibold tracking-tight">WeakSpot</span>
          <span className="text-[11px] text-white/60">{t.nav.brandSubtitle}</span>
        </span>
      </Link>

      <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
        <p className="text-[10px] font-bold tracking-[0.16em] text-[oklch(0.86_0.1_80)] uppercase">
          {t.nav.loopTitle}
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          {[t.nav.loop.discover, t.nav.loop.practice, t.nav.loop.remember].map((label, index) => (
            <div key={label} className="flex min-w-0 flex-1 items-center gap-1.5">
              {index > 0 ? <span className="h-px w-2 shrink-0 bg-white/20" aria-hidden="true" /> : null}
              <span className="min-w-0 truncate rounded-lg bg-white/10 px-1.5 py-1 text-center text-[10px] font-semibold text-white/85">
                {index + 1}.{label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/55">{t.nav.loopHint}</p>
      </div>

      <div>
        <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase">
          {t.nav.primaryTitle}
        </p>
        <div className="flex flex-col gap-1.5">
          {primaryItems.map((item, index) => {
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
                  "group relative flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 outline-none transition focus-visible:ring-3 focus-visible:ring-white/30",
                  isActive
                    ? "bg-[oklch(0.82_0.14_75)] text-stone-900 shadow-md"
                    : "bg-white/8 text-white/90 hover:bg-white/14",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
                    isActive ? "bg-stone-900/10" : "bg-white/10",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{localized[0]}</span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-[11px]",
                      isActive ? "text-stone-800/70" : "text-white/50",
                    )}
                  >
                    {localized[1]}
                  </span>
                </span>
                <Icon className={cn("size-4 shrink-0", isActive ? "opacity-80" : "opacity-60")} />
              </Link>
            )
          })}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-4" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => {
          const items = group.items
            .map((key) => visibleItems.find((item) => item.key === key))
            .filter((item): item is (typeof visibleItems)[number] => Boolean(item))
            .filter((item) => !PRIMARY_KEYS.has(item.key))

          if (items.length === 0) return null

          return (
            <section key={group.key} aria-labelledby={`nav-group-${group.key}`}>
              <h2
                id={`nav-group-${group.key}`}
                className="mb-1.5 px-2 text-[10px] font-bold tracking-[0.16em] text-white/40 uppercase"
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
                        "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-white/30",
                        isActive
                          ? "bg-white/16 font-semibold text-white"
                          : "text-white/65 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <Icon className="size-4 shrink-0 opacity-80" />
                      <span className="truncate">{localized[0]}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </nav>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/60">
        <p className="font-semibold text-[oklch(0.88_0.1_85)]">{t.nav.coachTipTitle}</p>
        <p className="mt-1">{t.nav.tagline}</p>
      </div>
    </div>
  )
}
