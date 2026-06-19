import { Stethoscope, LayoutDashboard, CalendarRange, Dumbbell, History, type LucideIcon } from "lucide-react"

export interface NavItem {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Diagnose", description: "Analyze your writing", icon: Stethoscope },
  { href: "/dashboard", label: "Dashboard", description: "Your weakness model", icon: LayoutDashboard },
  { href: "/plan", label: "Plan", description: "7-day study plan", icon: CalendarRange },
  { href: "/practice", label: "Practice", description: "Targeted exercises", icon: Dumbbell },
  { href: "/history", label: "History", description: "Past submissions", icon: History },
]
