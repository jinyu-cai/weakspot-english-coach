"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/nav"

export function NavSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-2 py-1">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/15">
          <span className="text-xl" aria-hidden="true">🌿</span>
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-heading text-base font-semibold text-sidebar-foreground">WeakSpot</span>
          <span className="text-xs text-muted-foreground">English Coach</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4.5 shrink-0" />
              <span className="flex flex-col leading-tight">
                <span>{item.label}</span>
                <span className="text-[11px] font-normal text-muted-foreground">{item.description}</span>
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="rounded-xl bg-sidebar-accent/50 p-3 text-xs leading-relaxed text-muted-foreground">
        {"It finds what you need to practice instead of asking what you want to practice."}
      </div>
    </div>
  )
}
