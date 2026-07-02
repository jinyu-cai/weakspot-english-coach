"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Shield, ShieldAlert, Trash2, UserPlus } from "lucide-react"
import { getMe, type Me } from "@/lib/auth"
import { listAccessRoles, upsertAccessRole, deleteAccessRole, type AccessRole } from "@/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLanguage } from "@/components/language-provider"

function RoleBadge({ role, label }: { role: string; label: string }) {
  return (
    <Badge variant={role === "owner" ? "default" : "secondary"}>
      {label}
    </Badge>
  )
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export default function AdminPage() {
  const { data: me } = useSWR<Me>("me", getMe)
  const { t } = useLanguage()
  const {
    data: roles,
    isLoading,
    mutate: refreshRoles,
  } = useSWR<AccessRole[]>("admin-access-roles", () => listAccessRoles(), {
    keepPreviousData: true,
  })

  const [identifier, setIdentifier] = useState("")
  const [role, setRole] = useState<"owner" | "member">("member")
  const [adding, setAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AccessRole | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (me && !me.isOwner) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={ShieldAlert}
          title={t.admin.denied}
          description={t.admin.deniedDescription}
        />
      </div>
    )
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = identifier.trim()
    if (!trimmed) return

    setAdding(true)
    try {
      await upsertAccessRole(trimmed, role)
      await refreshRoles()
      setIdentifier("")
      toast.success(t.admin.saved, { description: `${trimmed} ${t.admin.nowRole} ${role}.` })
    } catch (err) {
      toast.error(t.admin.saveFailed, { description: err instanceof Error ? err.message : t.import.tryShortly })
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAccessRole(deleteTarget.identifier)
      await refreshRoles()
      toast.success(t.admin.removed, { description: `${deleteTarget.identifier} ${t.admin.hasBeenRemoved}` })
    } catch (err) {
      toast.error(t.admin.removeFailed, { description: err instanceof Error ? err.message : t.import.tryShortly })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10">
          <Shield className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t.admin.title}</h1>
          <p className="text-sm text-muted-foreground">{t.admin.description}</p>
        </div>
      </div>

      {/* Add member form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4" />
            {t.admin.add}
          </CardTitle>
          <CardDescription>{t.admin.addDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium">
                {t.admin.identifier}
              </label>
              <Input
                id="identifier"
                placeholder={t.admin.identifierPlaceholder}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="w-full sm:w-36">
              <label htmlFor="role" className="mb-1.5 block text-sm font-medium">
                {t.admin.role}
              </label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={role === "member" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setRole("member")}
                >
                  {t.admin.member}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={role === "owner" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setRole("owner")}
                >
                  {t.admin.owner}
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={adding || !identifier.trim()} className="sm:self-end">
              {adding ? t.admin.saving : t.admin.addButton}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Roles list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.admin.roles}</CardTitle>
          <CardDescription>
            {roles ? `${roles.length} ${t.admin.configured}` : t.common.loading}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : !roles || roles.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t.admin.noRoles}
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {roles.map((r) => (
                <div key={r.identifier} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.identifier}</span>
                      <RoleBadge role={r.role} label={r.role === "owner" ? t.admin.owner : t.admin.member} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.admin.updated} {formatDate(r.updatedAt)}
                      {r.updatedBy ? ` by ${r.updatedBy}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${t.admin.removeLabel} ${r.identifier}`}
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.admin.removeTitle}</DialogTitle>
            <DialogDescription>
              {t.admin.removeDescription} <strong>{deleteTarget?.identifier}</strong>? {t.admin.losePrivileges}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t.common.removing : t.common.remove}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
