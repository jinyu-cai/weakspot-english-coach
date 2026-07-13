import {
  BookOpen,
  BrainCircuit,
  CalendarRange,
  Dumbbell,
  History,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Radio,
  Shield,
  Stethoscope,
  Trophy,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  key: "diagnose" | "chat" | "input" | "import" | "dashboard" | "memory" | "notebook" | "stats" | "plan" | "practice" | "history" | "admin"
  label: string
  description: string
  icon: LucideIcon
  ownerOnly?: boolean
}

export type NavGroupKey = "start" | "learn" | "progress" | "library" | "coach" | "admin"

export interface NavGroup {
  key: NavGroupKey
  items: NavItem["key"][]
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "diagnose", label: "Diagnose", description: "Analyze your writing", icon: Stethoscope },
  { href: "/chat", key: "chat", label: "Chat", description: "Practice conversations", icon: MessageCircle },
  { href: "/input", key: "input", label: "Input Lab", description: "Watch, read & listen", icon: Radio },
  { href: "/import", key: "import", label: "Import", description: "ChatGPT conversations", icon: Inbox },
  { href: "/dashboard", key: "dashboard", label: "Dashboard", description: "Your weakness model", icon: LayoutDashboard },
  { href: "/memory", key: "memory", label: "Memory", description: "What your coach remembers", icon: BrainCircuit },
  { href: "/notebook", key: "notebook", label: "Notebook", description: "Auto-collected notes", icon: BookOpen },
  { href: "/stats", key: "stats", label: "Daily Wins", description: "Your learning streak", icon: Trophy },
  { href: "/plan", key: "plan", label: "Plan", description: "7-day study plan", icon: CalendarRange },
  { href: "/practice", key: "practice", label: "Practice", description: "Targeted exercises", icon: Dumbbell },
  { href: "/history", key: "history", label: "History", description: "Past submissions", icon: History },
  { href: "/admin", key: "admin", label: "Admin", description: "Manage members", icon: Shield, ownerOnly: true },
]

// Grouping keeps every feature visible while giving first-time learners a
// clear path through the product. The order inside each group is intentional:
// the most useful next action comes first.
export const NAV_GROUPS: NavGroup[] = [
  { key: "start", items: ["diagnose", "chat", "practice"] },
  { key: "learn", items: ["input", "plan", "import"] },
  { key: "progress", items: ["dashboard", "stats"] },
  { key: "library", items: ["notebook", "history"] },
  { key: "coach", items: ["memory"] },
  { key: "admin", items: ["admin"] },
]
