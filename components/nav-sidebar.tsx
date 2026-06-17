"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GraduationCap, LayoutDashboard, CalendarCheck, Dumbbell, History, Stethoscope } from "lucide-react"
import { cn } from "@/lib/utils"

export const NAV_ITEMS = [
  { href: "/", label: "Diagnose", icon: Stethoscope, desc: "Analyze your writing" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Weakness profile" },
  { href: "/plan", label: "Plan", icon: CalendarCheck, desc: "7-day study plan" },
  { href: "/practice", label: "Practice", icon: Dumbbell, desc: "Targeted exercises" },
  { href: "/history", label: "History", icon: History, desc: "Past submissions" },
]

export function NavSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl px-2 py-1.5"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="size-5" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight">WeakSpot</span>
          <span className="text-xs text-muted-foreground">English Coach</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4.5 shrink-0" />
              <span className="flex flex-col">
                <span>{item.label}</span>
                <span className="text-xs font-normal opacity-70">{item.desc}</span>
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="rounded-xl bg-sidebar-accent/50 p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-sidebar-accent-foreground">为什么不同？</p>
        <p className="mt-1">它不问你想练什么，而是发现你真正需要练什么。</p>
      </div>
    </div>
  )
}
