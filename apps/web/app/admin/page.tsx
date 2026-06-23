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

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant={role === "owner" ? "default" : "secondary"}>
      {role}
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
          title="Access denied"
          description="This page is only available to owners."
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
      toast.success("Access role saved", { description: `${trimmed} is now a ${role}.` })
    } catch (err) {
      toast.error("Failed to save role", { description: err instanceof Error ? err.message : "Please try again." })
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
      toast.success("Access role removed", { description: `${deleteTarget.identifier} has been removed.` })
    } catch (err) {
      toast.error("Failed to remove role", { description: err instanceof Error ? err.message : "Please try again." })
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
          <h1 className="font-heading text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">Manage access roles for owners and members.</p>
        </div>
      </div>

      {/* Add member form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4" />
            Add access role
          </CardTitle>
          <CardDescription>Enter a GitHub login or email address to grant access.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium">
                Identifier
              </label>
              <Input
                id="identifier"
                placeholder="user@example.com or github-login"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="w-full sm:w-36">
              <label htmlFor="role" className="mb-1.5 block text-sm font-medium">
                Role
              </label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={role === "member" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setRole("member")}
                >
                  Member
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={role === "owner" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setRole("owner")}
                >
                  Owner
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={adding || !identifier.trim()} className="sm:self-end">
              {adding ? "Saving..." : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Roles list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access roles</CardTitle>
          <CardDescription>
            {roles ? `${roles.length} role${roles.length === 1 ? "" : "s"} configured` : "Loading..."}
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
              No access roles configured yet. Add one above.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {roles.map((r) => (
                <div key={r.identifier} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.identifier}</span>
                      <RoleBadge role={r.role} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDate(r.updatedAt)}
                      {r.updatedBy ? ` by ${r.updatedBy}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${r.identifier}`}
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
            <DialogTitle>Remove access role</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.identifier}</strong>?
              They will lose their <strong>{deleteTarget?.role}</strong> privileges.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
