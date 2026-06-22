import {
  BookOpen,
  CalendarRange,
  Dumbbell,
  History,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Stethoscope,
  Trophy,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Diagnose", description: "Analyze your writing", icon: Stethoscope },
  { href: "/chat", label: "Chat", description: "Practice conversations", icon: MessageCircle },
  { href: "/import", label: "Import", description: "ChatGPT conversations", icon: Inbox },
  { href: "/dashboard", label: "Dashboard", description: "Your weakness model", icon: LayoutDashboard },
  { href: "/notebook", label: "Notebook", description: "Auto-collected notes", icon: BookOpen },
  { href: "/stats", label: "Daily Wins", description: "Your learning streak", icon: Trophy },
  { href: "/plan", label: "Plan", description: "7-day study plan", icon: CalendarRange },
  { href: "/practice", label: "Practice", description: "Targeted exercises", icon: Dumbbell },
  { href: "/history", label: "History", description: "Past submissions", icon: History },
]
