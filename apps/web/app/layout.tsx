import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono, Instrument_Serif } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "@/components/app-shell"
import { DiagnoseProvider } from "@/components/diagnose-provider"
import { Toaster } from "@/components/ui/sonner"
import { LoginGate } from "@/components/login-gate"
import { LanguageProvider } from "@/components/language-provider"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

/* Hermes site uses a custom serif (Sigurd); Instrument Serif is the close public stand-in. */
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400"],
})

export const metadata: Metadata = {
  title: "WeakSpot English Coach",
  description:
    "An adaptive English-learning coach for Chinese-speaking learners. Instead of asking what you want to practice, it discovers what you need to practice.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} ${instrument.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var p=localStorage.getItem('weakspot-palette');if(p&&p!=='cream'){document.documentElement.setAttribute('data-palette',p)}var l=localStorage.getItem('weakspot-language');if(l==='zh-CN'){document.documentElement.lang=l}}catch(e){}",
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <LanguageProvider>
            <AppShell>
              <DiagnoseProvider>{children}</DiagnoseProvider>
            </AppShell>
            <LoginGate />
          </LanguageProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
