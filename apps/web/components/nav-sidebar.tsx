"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, PanelLeftClose, PanelLeftOpen, PlayCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/nav"
import { getMe } from "@/lib/auth"
import { useLanguage } from "@/components/language-provider"
import { useTaskResume } from "@/lib/task-resume"

export function NavSidebar({
  collapsed = false,
  onNavigate,
  onToggleCollapsed,
}: {
  collapsed?: boolean
  onNavigate?: () => void
  onToggleCollapsed?: () => void
}) {
  const pathname = usePathname()
  const [isOwner, setIsOwner] = useState(false)
  const { language, t } = useLanguage()
  const resume = useTaskResume()

  useEffect(() => {
    getMe().then((me) => setIsOwner(!!me.isOwner))
  }, [])

  const visibleItems = NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner)
  const activeHref = [...visibleItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)))
    ?.href
  const coreKeys = NAV_GROUPS.find((group) => group.key === "start")?.items ?? []
  const advancedKeys = NAV_GROUPS
    .filter((group) => group.key !== "start" && group.key !== "admin")
    .flatMap((group) => group.items)
  const coreItems = coreKeys
    .map((key) => visibleItems.find((item) => item.key === key))
    .filter((item): item is (typeof visibleItems)[number] => Boolean(item))
  const advancedItems = advancedKeys
    .map((key) => visibleItems.find((item) => item.key === key))
    .filter((item): item is (typeof visibleItems)[number] => Boolean(item))
  const adminItems = visibleItems.filter((item) => item.key === "admin")
  const advancedIsActive = advancedItems.some((item) => item.href === activeHref)
  const [advancedOpen, setAdvancedOpen] = useState(advancedIsActive)
  const showAdvanced = advancedOpen || advancedIsActive

  function renderNavItem(item: (typeof visibleItems)[number]) {
    const isActive = item.href === activeHref
    const Icon = item.icon
    const localized = t.nav.items[item.key]
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        aria-label={collapsed ? localized[0] : undefined}
        title={collapsed ? localized[0] : undefined}
        className={cn(
          "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/35",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/10"
            : "text-muted-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
        )}
      >
        <Icon className={cn("size-[18px] shrink-0", isActive && "text-primary")} />
        {!collapsed ? (
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate">{localized[0]}</span>
            {isActive ? (
              <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
                {localized[1]}
              </span>
            ) : null}
          </span>
        ) : null}
        {item.key === "mission" && !isActive ? (
          <span
            className={cn("size-1.5 rounded-full bg-primary", collapsed && "absolute top-2 right-2")}
            aria-label={t.nav.startHere}
          />
        ) : null}
      </Link>
    )
  }

  return (
    <div className={cn("flex min-h-full flex-col gap-5 p-3.5", collapsed && "gap-3 px-3")}>
      <div className={cn("flex items-center gap-1", collapsed && "flex-col gap-2")}>
        <Link
          href="/"
          onClick={onNavigate}
          aria-label={collapsed ? "WeakSpot English Coach" : undefined}
          title={collapsed ? "WeakSpot English Coach" : undefined}
          className={cn(
            "group flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1.5 outline-none transition focus-visible:ring-3 focus-visible:ring-ring/40",
            collapsed && "justify-center px-0",
          )}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3">
            <span className="text-xl" aria-hidden="true">
              🦉
            </span>
          </span>
          {!collapsed ? (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-heading text-lg font-semibold tracking-tight text-sidebar-foreground">
                WeakSpot
              </span>
              <span className="text-[11px] text-muted-foreground">English Coach</span>
            </span>
          ) : null}
        </Link>
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed
              ? (language === "zh-CN" ? "展开左侧栏" : "Expand sidebar")
              : (language === "zh-CN" ? "收起左侧栏" : "Collapse sidebar")}
            title={collapsed
              ? (language === "zh-CN" ? "展开左侧栏" : "Expand sidebar")
              : (language === "zh-CN" ? "收起左侧栏" : "Collapse sidebar")}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none transition hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/35"
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          </button>
        ) : null}
      </div>

      {resume ? (
        <Link
          href={resume.href}
          onClick={onNavigate}
          aria-label={collapsed
            ? `${language === "zh-CN" ? "继续学习" : "Continue learning"}: ${resume.title}`
            : undefined}
          title={collapsed
            ? `${language === "zh-CN" ? "继续学习" : "Continue learning"}: ${resume.title}`
            : undefined}
          className={cn(
            "group flex min-h-11 items-center gap-3 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2.5 text-sm outline-none transition hover:border-primary/45 hover:bg-primary/12 focus-visible:ring-3 focus-visible:ring-ring/40",
            collapsed && "justify-center px-2",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PlayCircle className="size-4" />
          </span>
          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold tracking-wide text-primary uppercase">
                {language === "zh-CN" ? "继续学习" : "Continue learning"}
              </span>
              <span className="block truncate font-medium text-sidebar-foreground">{resume.title}</span>
            </span>
          ) : null}
        </Link>
      ) : null}

      <nav className={cn("flex flex-1 flex-col gap-4", collapsed && "gap-2")} aria-label="Main navigation">
        <section aria-labelledby="nav-group-start">
          <h2 id="nav-group-start" className={cn("mb-1 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/80 uppercase", collapsed && "sr-only")}>
            {t.nav.groups.start}
          </h2>
          <div className="flex flex-col gap-0.5">{coreItems.map(renderNavItem)}</div>
        </section>

        {collapsed ? (
          <section aria-labelledby="nav-group-more">
            <h2 id="nav-group-more" className="sr-only">
              {language === "zh-CN" ? "更多学习工具" : "More learning tools"}
            </h2>
            <div className="flex flex-col gap-0.5 border-t border-sidebar-border pt-2">
              {advancedItems.map(renderNavItem)}
            </div>
          </section>
        ) : (
          <section>
            <button
              type="button"
              aria-expanded={showAdvanced}
              onClick={() => setAdvancedOpen((value) => !value)}
              className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/80 uppercase outline-none transition hover:bg-sidebar-accent/45 focus-visible:ring-3 focus-visible:ring-sidebar-ring/35"
            >
              <span>{language === "zh-CN" ? "更多学习工具" : "More learning tools"}</span>
              <ChevronDown className={cn("size-4 transition-transform", showAdvanced && "rotate-180")} />
            </button>
            {showAdvanced ? <div className="mt-1 flex flex-col gap-0.5">{advancedItems.map(renderNavItem)}</div> : null}
          </section>
        )}

        {adminItems.length > 0 ? (
          <section aria-labelledby="nav-group-admin">
            <h2 id="nav-group-admin" className={cn("mb-1 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/80 uppercase", collapsed && "sr-only")}>
              {t.nav.groups.admin}
            </h2>
            <div className={cn("flex flex-col gap-0.5", collapsed && "border-t border-sidebar-border pt-2")}>
              {adminItems.map(renderNavItem)}
            </div>
          </section>
        ) : null}
      </nav>

      {!collapsed ? (
        <div className="rounded-2xl border border-sidebar-border bg-card/70 p-3 text-xs leading-relaxed text-muted-foreground shadow-sm">
          {t.nav.tagline}
        </div>
      ) : null}
    </div>
  )
}
