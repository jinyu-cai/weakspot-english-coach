import {
  BookOpen,
  CalendarRange,
  Dumbbell,
  History,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Shield,
  Stethoscope,
  Trophy,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  key: "diagnose" | "chat" | "import" | "dashboard" | "notebook" | "stats" | "plan" | "practice" | "history" | "admin"
  label: string
  description: string
  icon: LucideIcon
  ownerOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "diagnose", label: "Diagnose", description: "Analyze your writing", icon: Stethoscope },
  { href: "/chat", key: "chat", label: "Chat", description: "Practice conversations", icon: MessageCircle },
  { href: "/import", key: "import", label: "Import", description: "ChatGPT conversations", icon: Inbox },
  { href: "/dashboard", key: "dashboard", label: "Dashboard", description: "Your weakness model", icon: LayoutDashboard },
  { href: "/notebook", key: "notebook", label: "Notebook", description: "Auto-collected notes", icon: BookOpen },
  { href: "/stats", key: "stats", label: "Daily Wins", description: "Your learning streak", icon: Trophy },
  { href: "/plan", key: "plan", label: "Plan", description: "7-day study plan", icon: CalendarRange },
  { href: "/practice", key: "practice", label: "Practice", description: "Targeted exercises", icon: Dumbbell },
  { href: "/history", key: "history", label: "History", description: "Past submissions", icon: History },
  { href: "/admin", key: "admin", label: "Admin", description: "Manage members", icon: Shield, ownerOnly: true },
]
