const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const OWNER_BYPASS_TOKEN = process.env.NEXT_PUBLIC_OWNER_BYPASS_TOKEN

export type Me = {
  authenticated: boolean
  userId?: string
  login?: string
  name?: string | null
  avatarUrl?: string | null
  isOwner?: boolean
  isMember?: boolean
  accessTier?: "owner" | "member" | "user" | "guest"
  guestLimit?: number
}

export async function getMe(): Promise<Me> {
  if (!API_BASE_URL) return { authenticated: false }
  try {
    const headers: Record<string, string> = {}
    if (OWNER_BYPASS_TOKEN) headers["X-Owner-Token"] = OWNER_BYPASS_TOKEN
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, { credentials: "include", headers })
    if (!res.ok) return { authenticated: false }
    return (await res.json()) as Me
  } catch {
    return { authenticated: false }
  }
}

export type AuthProvider = "github" | "google"

export function loginUrl(provider: AuthProvider = "github", redirect?: string): string {
  const r = redirect ?? (typeof window !== "undefined" ? window.location.href : "")
  return `${API_BASE_URL}/api/v1/auth/${provider}/login?redirect=${encodeURIComponent(r)}`
}

export function startLogin(provider: AuthProvider = "github", redirect?: string) {
  if (!API_BASE_URL) return
  window.location.href = loginUrl(provider, redirect)
}

export async function logout(): Promise<void> {
  if (!API_BASE_URL) return
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" })
  } catch {
    // ignore
  }
}
