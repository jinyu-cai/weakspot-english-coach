const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export type Me = {
  authenticated: boolean
  userId?: string
  login?: string
  name?: string | null
  avatarUrl?: string | null
  isOwner?: boolean
  guestLimit?: number
}

export async function getMe(): Promise<Me> {
  if (!API_BASE_URL) return { authenticated: false }
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, { credentials: "include" })
    if (!res.ok) return { authenticated: false }
    return (await res.json()) as Me
  } catch {
    return { authenticated: false }
  }
}

export function loginUrl(redirect?: string): string {
  const r = redirect ?? (typeof window !== "undefined" ? window.location.href : "")
  return `${API_BASE_URL}/api/v1/auth/github/login?redirect=${encodeURIComponent(r)}`
}

export function startLogin(redirect?: string) {
  if (!API_BASE_URL) return
  window.location.href = loginUrl(redirect)
}

export async function logout(): Promise<void> {
  if (!API_BASE_URL) return
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" })
  } catch {
    // ignore
  }
}
