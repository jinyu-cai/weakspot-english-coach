"use client"

import { useEffect, useState } from "react"
import { Code2, LogOut, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMe, startLogin, logout, type Me } from "@/lib/auth"

export function AuthButton() {
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    getMe().then(setMe)
  }, [])

  if (!me || !me.authenticated) {
    return (
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => startLogin("github")}>
          <Code2 className="size-4" />
          <span className="hidden sm:inline">GitHub</span>
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => startLogin("google")}>
          <Mail className="size-4" />
          <span className="hidden sm:inline">Google</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {me.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={me.avatarUrl} alt="" className="size-7 rounded-full border border-border" />
      ) : null}
      <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:inline">
        {me.name || me.login}
        {me.isOwner ? " · owner" : me.isMember ? " · member" : ""}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        onClick={async () => {
          await logout()
          location.reload()
        }}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  )
}
