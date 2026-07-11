"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Code2, Mail, ShieldCheck, Sparkles } from "lucide-react"
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
        <div className="absolute -left-24 -top-24 size-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 size-96 rounded-full bg-accent/50 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 size-48 -translate-x-1/2 rounded-full bg-success/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card/90 shadow-2xl shadow-primary/5 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-[610px] flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
          <Link href="/" className="flex w-fit items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-sidebar-primary/20 text-2xl">🦉</span>
            <span>
              <span className="block font-heading text-xl font-semibold">WeakSpot</span>
              <span className="block text-sm text-muted-foreground">English Coach</span>
            </span>
          </Link>

          <div className="space-y-6">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-sidebar-primary/20 text-sidebar-primary">
              <Sparkles className="size-6" />
            </div>
            <div className="space-y-3">
              <h1 className="max-w-md text-balance font-heading text-4xl font-bold leading-tight">
                {isChinese ? "让每次练习，都针对你的真实薄弱点。" : "Practice what your English actually needs."}
              </h1>
              <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
                {isChinese
                  ? "登录后保存你的诊断、学习计划和进步记录，让 WeakSpot 持续为你调整练习。"
                  : "Sign in to save diagnoses, learning plans, and progress so WeakSpot can keep adapting to you."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
              <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-3xl sm:mx-0 lg:hidden">🦉</div>
              <CardTitle className="font-heading text-3xl font-bold">
                {isChinese ? "欢迎回来" : "Welcome back"}
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                {isChinese ? "选择一种方式继续你的英语学习。" : "Choose a sign-in method to continue learning."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 px-0">
              <Button
                size="lg"
                className="h-12 w-full justify-center gap-3 text-sm"
                disabled={checkingSession || !configured}
                onClick={() => signIn("github")}
              >
                <Code2 className="size-5" />
                {isChinese ? "使用 GitHub 登录" : "Continue with GitHub"}
              </Button>
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

              {checkingSession ? (
                <p className="text-center text-sm text-muted-foreground">
                  {isChinese ? "正在检查登录状态…" : "Checking your session…"}
                </p>
              ) : !configured ? (
                <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center text-sm text-warning-foreground">
                  {isChinese
                    ? "尚未配置登录服务。请设置 NEXT_PUBLIC_API_BASE_URL。"
                    : "Sign-in is not configured. Set NEXT_PUBLIC_API_BASE_URL to enable it."}
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
