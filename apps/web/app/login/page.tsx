import type { Metadata } from "next"
import { LoginPage } from "@/components/login-page"

export const metadata: Metadata = {
  title: "Sign in | WeakSpot English Coach",
  description: "Sign in to save your English learning progress.",
}

export default async function LoginRoute({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>
}) {
  const params = await searchParams
  const redirect = typeof params.redirect === "string" ? params.redirect : "/"

  return <LoginPage redirect={redirect} />
}
