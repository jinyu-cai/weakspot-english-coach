"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { startLogin } from "@/lib/auth"

/**
 * Listens for the `weakspot:needauth` event (dispatched by api-client on a 429)
 * and prompts the user to sign in with GitHub to keep going.
 */
export function LoginGate() {
  useEffect(() => {
    function onNeedAuth(e: Event) {
      const detail = (e as CustomEvent).detail as { message?: string } | undefined
      toast.error(detail?.message || "免费次数已用完，请登录后继续。", {
        action: { label: "GitHub 登录", onClick: () => startLogin() },
        duration: 8000,
      })
    }
    window.addEventListener("weakspot:needauth", onNeedAuth)
    return () => window.removeEventListener("weakspot:needauth", onNeedAuth)
  }, [])

  return null
}
