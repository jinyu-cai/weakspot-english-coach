"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Code2, Mail, ShieldCheck } from "lucide-react"
import { BrandMark } from "@/components/brand-mark"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getMe, isAuthConfigured, startLogin, type AuthProvider } from "@/lib/auth"
import { useLanguage } from "@/components/language-provider"

function safeRedirect(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/"
  return value
}

export function LoginPage({ redirect }: { redirect: string }) {
  const router = useRouter()
  const { language } = useLanguage()
  const [checkingSession, setCheckingSession] = useState(true)
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([])
  const destination = safeRedirect(redirect)
  const configured = isAuthConfigured()
  const isChinese = language === "zh-CN"

  useEffect(() => {
    let active = true
    getMe().then((me) => {
      if (!active) return
      if (me.authenticated) {
        router.replace(destination)
        return
      }
      setAuthProviders(me.authProviders ?? [])
      setCheckingSession(false)
    })
    return () => {
      active = false
    }
  }, [destination, router])

  function signIn(provider: AuthProvider) {
    startLogin(provider, `${window.location.origin}${destination}`)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(64rem_36rem_at_50%_-12%,color-mix(in_oklch,var(--primary)_7%,transparent),transparent_62%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,color-mix(in_oklch,var(--border)_35%,transparent))]" />
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card/90 shadow-2xl shadow-primary/5 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-[610px] flex-col justify-between border-r border-sidebar-border bg-sidebar p-10 text-sidebar-foreground lg:flex">
          <Link href="/" className="flex w-fit items-center gap-3">
            <BrandMark className="size-11 rounded-md" />
            <span>
              <span className="block font-heading text-2xl font-semibold tracking-tight">WeakSpot</span>
              <span className="label-mono mt-0.5 block text-muted-foreground">English Coach</span>
            </span>
          </Link>

          <div className="space-y-6">
            <p className="label-mono text-primary">
              {isChinese ? "诊断 · 练习 · 进步" : "Diagnose · Practice · Progress"}
            </p>
            <div className="space-y-4">
              <h1 className="max-w-md text-balance font-heading text-[2.6rem] font-semibold leading-[1.15]">
                {isChinese ? (
                  <>让每次练习，都针对你的<span className="text-primary">真实薄弱点</span>。</>
                ) : (
                  <>Practice what your English <em className="text-primary">actually</em> needs.</>
                )}
              </h1>
              <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
                {isChinese
                  ? "登录后保存你的诊断、学习计划和进步记录，让 WeakSpot 持续为你调整练习。"
                  : "Sign in to save diagnoses, learning plans, and progress so WeakSpot can keep adapting to you."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-sidebar-border pt-5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-success" />
            {isChinese ? "安全登录，不会读取你的密码" : "Secure sign-in. We never see your password."}
          </div>
        </section>

        <section className="flex min-h-[610px] items-center p-6 sm:p-10 lg:p-12">
          <Card className="w-full border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 text-center sm:text-left">
              <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground sm:mx-0 lg:hidden">
                <ArrowLeft className="size-4" />
                {isChinese ? "返回 WeakSpot" : "Back to WeakSpot"}
              </Link>
              <BrandMark className="mx-auto mb-5 size-14 rounded-lg sm:mx-0 lg:hidden" />
              <p className="label-mono mb-2 text-primary">
                {isChinese ? "欢迎回来" : "Welcome back"}
              </p>
              <CardTitle className="font-heading text-3xl font-semibold">
                {isChinese ? "继续你的学习" : "Continue learning"}
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                {isChinese ? "选择一种方式继续你的英语学习。" : "Choose a sign-in method to continue learning."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 px-0">
              {authProviders.includes("github") ? (
                <Button
                  size="lg"
                  className="h-12 w-full justify-center gap-3 text-sm"
                  disabled={checkingSession || !configured}
                  onClick={() => signIn("github")}
                >
                  <Code2 className="size-5" />
                  {isChinese ? "使用 GitHub 登录" : "Continue with GitHub"}
                </Button>
              ) : null}
              {authProviders.includes("google") ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 w-full justify-center gap-3 text-sm"
                  disabled={checkingSession || !configured}
                  onClick={() => signIn("google")}
                >
                  <Mail className="size-5" />
                  {isChinese ? "使用 Google 登录" : "Continue with Google"}
                </Button>
              ) : null}

              {checkingSession ? (
                <p className="text-center text-sm text-muted-foreground">
                  {isChinese ? "正在检查登录状态…" : "Checking your session…"}
                </p>
              ) : !configured ? (
                <p className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-center text-sm text-warning-foreground">
                  {isChinese
                    ? "尚未配置登录服务。请设置 NEXT_PUBLIC_API_BASE_URL。"
                    : "Sign-in is not configured. Set NEXT_PUBLIC_API_BASE_URL to enable it."}
                </p>
              ) : authProviders.length === 0 ? (
                <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center text-sm text-warning-foreground">
                  {isChinese ? "登录服务目前不可用，请稍后再试。" : "Sign-in is currently unavailable. Please try again later."}
                </p>
              ) : null}

              <p className="pt-4 text-center text-xs leading-relaxed text-muted-foreground">
                {isChinese
                  ? "继续即表示你同意使用第三方账号进行身份验证。"
                  : "By continuing, you agree to authenticate with the selected provider."}
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
