"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileUp,
  GraduationCap,
  Languages,
  Library,
  LoaderCircle,
  NotebookPen,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { getMe, isAuthConfigured, loginPageUrl } from "@/lib/auth"
import {
  createEbookAnnotation,
  createEbookStudyPack,
  deleteEbook,
  deleteEbookStudyPack,
  getEbook,
  getEbookStudyPack,
  getEbookStudyPacks,
  getEbooks,
  importEbook,
  markEbookAnnotationUnfamiliar,
  startEbookPractice,
  submitEbookPractice,
  updateEbookLanguage,
  waitForEbookStudyPack,
} from "@/lib/api-client"
import type {
  Ebook,
  EbookAnnotation,
  EbookComparisonLanguage,
  EbookModelTier,
  EbookLearningTarget,
  EbookPracticeAttempt,
  EbookPracticeSession,
  EbookSentenceUnit,
  EbookStudyPage,
  EbookStudyPack,
} from "@/lib/types"
import { cn } from "@/lib/utils"


type SelectionDraft = {
  unit: EbookSentenceUnit
  startOffset: number
  endOffset: number
  text: string
}

type EbookReaderView = "reading" | "study"

export default function EbookLearningPage() {
  const { language } = useLanguage()
  const zh = language === "zh-CN"
  const [authChecked, setAuthChecked] = useState(!isAuthConfigured())
  const [authenticated, setAuthenticated] = useState(!isAuthConfigured())
  const [uploading, setUploading] = useState(false)
  const [draggingFile, setDraggingFile] = useState(false)
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [uploadLanguage, setUploadLanguage] = useState<EbookComparisonLanguage>(zh ? "zh-CN" : "en")
  const [activeBook, setActiveBook] = useState<Ebook | null>(null)
  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(1)
  const [studyTier, setStudyTier] = useState<EbookModelTier>("deep")
  const [studyPack, setStudyPack] = useState<EbookStudyPack | null>(null)
  const [studying, setStudying] = useState(false)
  const [deletingStudyPackId, setDeletingStudyPackId] = useState<string | null>(null)
  const [readerView, setReaderView] = useState<EbookReaderView>("study")
  const [selection, setSelection] = useState<SelectionDraft | null>(null)
  const [addingSelection, setAddingSelection] = useState(false)
  const [extraAnnotations, setExtraAnnotations] = useState<EbookAnnotation[]>([])
  const [targetsByAnnotation, setTargetsByAnnotation] = useState<Record<string, EbookLearningTarget>>({})
  const [practice, setPractice] = useState<EbookPracticeSession | null>(null)
  const [practiceTarget, setPracticeTarget] = useState<EbookLearningTarget | null>(null)
  const [practiceAnswer, setPracticeAnswer] = useState("")
  const [practiceHint, setPracticeHint] = useState(false)
  const [practiceSubmitting, setPracticeSubmitting] = useState(false)
  const [lastAttempt, setLastAttempt] = useState<EbookPracticeAttempt | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const studyPackAbortRef = useRef<AbortController | null>(null)
  const studyPackSelectionRef = useRef(0)

  useEffect(() => {
    if (!isAuthConfigured()) return
    getMe().then((me) => {
      setAuthenticated(me.authenticated)
      setAuthChecked(true)
    })
  }, [])

  const readingFocusActive = readerView === "reading"
    && Boolean(studyPack?.pages?.length)

  useEffect(() => {
    if (!readingFocusActive) return
    const previousOverflow = document.body.style.overflow
    const leaveReadingFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReaderView("study")
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", leaveReadingFocus)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", leaveReadingFocus)
    }
  }, [readingFocusActive])

  const { data: books = [], mutate: refreshBooks } = useSWR(
    authenticated ? "ebooks:library" : null,
    getEbooks,
    { refreshInterval: (rows) => rows?.some((book) => book.status === "processing") ? 2500 : 0 },
  )

  const {
    data: studyPackHistory = [],
    isLoading: loadingStudyPackHistory,
    mutate: refreshStudyPackHistory,
  } = useSWR(
    activeBook?.status === "ready" ? `ebooks:${activeBook.id}:study-packs` : null,
    () => getEbookStudyPacks(activeBook!.id),
    {
      refreshInterval: (rows) => rows?.some((pack) => pack.status === "processing") ? 5000 : 0,
    },
  )

  useEffect(() => {
    if (!activeBook) return
    const next = books.find((book) => book.id === activeBook.id)
    if (!next || next.updatedAt === activeBook.updatedAt) return
    const timer = window.setTimeout(() => setActiveBook(next), 0)
    return () => window.clearTimeout(timer)
  }, [activeBook, books])

  useEffect(() => {
    if (!activeBook) return
    let cancelled = false
    const controller = new AbortController()
    studyPackAbortRef.current?.abort()
    studyPackAbortRef.current = controller
    const selectionId = ++studyPackSelectionRef.current
    const savedRange = activeBook.lastStudyRange
    const initial = savedRange?.startPage ?? (activeBook.lastStudiedPage
      ? Math.min(activeBook.pageCount, activeBook.lastStudiedPage + 1)
      : 1)
    const timer = window.setTimeout(() => {
      setStartPage(Math.max(1, initial))
      setEndPage(Math.max(1, savedRange?.endPage ?? initial))
      setStudyTier(savedRange?.modelTier ?? "deep")
      setStudyPack(null)
      setExtraAnnotations([])
      setSelection(null)
      if (!activeBook.lastStudyPackId) return
      setStudying(true)
      void (async () => {
        try {
          const restored = await getEbookStudyPack(activeBook.lastStudyPackId!)
          if (cancelled || studyPackSelectionRef.current !== selectionId) return
          setStudyPack(restored)
          setStudyTier(restored.modelTier)
          if (restored.status === "processing") {
            const completed = await waitForEbookStudyPack(
              restored,
              (progress) => {
                if (!cancelled && studyPackSelectionRef.current === selectionId) setStudyPack(progress)
              },
              controller.signal,
            )
            if (!cancelled && studyPackSelectionRef.current === selectionId) setStudyPack(completed)
          }
        } catch (error) {
          if (!cancelled) {
            toast.error(zh ? "无法恢复上次学习内容" : "Could not restore the previous study pack", {
              description: error instanceof Error ? error.message : undefined,
            })
          }
        } finally {
          if (!cancelled && studyPackSelectionRef.current === selectionId) setStudying(false)
        }
      })()
    }, 0)
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [activeBook?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const allAnnotations = useMemo(() => Array.from(new Map([
    ...(studyPack?.pages?.flatMap((page) => page.annotations) ?? []),
    ...extraAnnotations,
  ].map((annotation) => [annotation.id, annotation])).values()), [extraAnnotations, studyPack?.pages])
  const annotationsByUnit = useMemo(() => {
    return allAnnotations.reduce<Record<string, EbookAnnotation[]>>((result, annotation) => {
      result[annotation.unitId] = [...(result[annotation.unitId] ?? []), annotation]
      return result
    }, {})
  }, [allAnnotations])

  async function handleUpload(file: File) {
    if (!rightsConfirmed) {
      toast.error(zh ? "请先确认你有权处理这份电子书。" : "Confirm that you have the right to process this ebook.")
      return
    }
    if (!/\.(epub|pdf)$/i.test(file.name)) {
      toast.error(zh ? "请选择 EPUB 或带文字层的 PDF。" : "Choose an EPUB or a text-based PDF.")
      return
    }
    setUploading(true)
    try {
      const book = await importEbook(file, uploadLanguage)
      setActiveBook(book)
      await refreshBooks()
      toast.success(zh ? "已开始解析电子书。" : "Ebook parsing has started.")
    } catch (error) {
      toast.error(zh ? "导入失败" : "Import failed", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  async function openBook(book: Ebook) {
    try {
      const fresh = await getEbook(book.id)
      setActiveBook(fresh)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  async function changeLanguage(value: EbookComparisonLanguage) {
    if (!activeBook) return
    try {
      const updated = await updateEbookLanguage(activeBook.id, value)
      setActiveBook(updated)
      setStudyPack(null)
      await refreshBooks()
      await refreshStudyPackHistory()
      toast.success(zh ? "之后生成的学习页将使用新语言。" : "New study pages will use the updated language.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  async function removeBook(book: Ebook) {
    if (!window.confirm(zh ? `删除《${book.title}》及其正文、批注和书籍来源笔记？` : `Delete ${book.title}, its text, annotations, and ebook notes?`)) return
    try {
      await deleteEbook(book.id)
      if (activeBook?.id === book.id) setActiveBook(null)
      await refreshBooks()
      toast.success(zh ? "电子书及其来源数据已删除。" : "The ebook and its source data were deleted.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  function setRangeStart(value: number) {
    if (!activeBook) return
    const next = Math.max(1, Math.min(activeBook.pageCount, value || 1))
    setStartPage(next)
    setEndPage((current) => Math.max(next, Math.min(current, next + 14, activeBook.pageCount)))
  }

  function setRangeEnd(value: number) {
    if (!activeBook) return
    setEndPage(Math.max(startPage, Math.min(activeBook.pageCount, startPage + 14, value || startPage)))
  }

  async function beginStudy(forceRetry = false) {
    if (!activeBook || activeBook.status !== "ready") return
    studyPackAbortRef.current?.abort()
    const controller = new AbortController()
    studyPackAbortRef.current = controller
    const selectionId = ++studyPackSelectionRef.current
    setStudying(true)
    if (!forceRetry) setStudyPack(null)
    setExtraAnnotations([])
    try {
      const selectedTier = forceRetry && studyPack ? studyPack.modelTier : studyTier
      const selectedStartPage = forceRetry && studyPack ? studyPack.startPage : startPage
      const selectedEndPage = forceRetry && studyPack ? studyPack.endPage : endPage
      const started = await createEbookStudyPack(
        activeBook.id,
        selectedStartPage,
        selectedEndPage,
        selectedTier,
        forceRetry,
      )
      await refreshStudyPackHistory()
      if (studyPackSelectionRef.current !== selectionId) return
      setStudyPack(started)
      setStudyTier(started.modelTier)
      const completed = await waitForEbookStudyPack(
        started,
        (progress) => {
          if (studyPackSelectionRef.current === selectionId) setStudyPack(progress)
        },
        controller.signal,
      )
      if (studyPackSelectionRef.current !== selectionId) return
      setStudyPack(completed)
      await Promise.all([refreshBooks(), refreshStudyPackHistory()])
      if (completed.status === "failed") {
        toast.error(zh ? "部分学习页生成失败" : "Some study pages failed", { description: completed.error ?? undefined })
      } else {
        toast.success(zh ? "逐句学习页已准备好。" : "Your sentence-by-sentence study pages are ready.")
      }
    } catch (error) {
      toast.error(zh ? "生成学习页失败" : "Could not prepare study pages", { description: error instanceof Error ? error.message : undefined })
    } finally {
      if (studyPackSelectionRef.current === selectionId) setStudying(false)
    }
  }

  async function openStoredStudyPack(summary: EbookStudyPack) {
    studyPackAbortRef.current?.abort()
    const controller = new AbortController()
    studyPackAbortRef.current = controller
    const selectionId = ++studyPackSelectionRef.current
    setStartPage(summary.startPage)
    setEndPage(summary.endPage)
    setStudyTier(summary.modelTier)
    setExtraAnnotations([])
    setSelection(null)
    setStudying(summary.status === "processing")
    try {
      const restored = await getEbookStudyPack(summary.id)
      if (studyPackSelectionRef.current !== selectionId) return
      setStudyPack(restored)
      if (restored.status === "processing") {
        const completed = await waitForEbookStudyPack(
          restored,
          (progress) => {
            if (studyPackSelectionRef.current === selectionId) setStudyPack(progress)
          },
          controller.signal,
        )
        if (studyPackSelectionRef.current === selectionId) setStudyPack(completed)
      }
    } catch (error) {
      if (studyPackSelectionRef.current === selectionId) {
        toast.error(zh ? "无法打开这段已分析内容" : "Could not open this analyzed range", {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    } finally {
      if (studyPackSelectionRef.current === selectionId) setStudying(false)
    }
  }

  async function removeStudyPack(pack: EbookStudyPack) {
    if (deletingStudyPackId) return
    const rangeLabel = zh
      ? `第 ${pack.startPage}–${pack.endPage} 页（${pack.modelTier === "fast" ? "Fast" : "Deep"}）`
      : `pages ${pack.startPage}–${pack.endPage} (${pack.modelTier === "fast" ? "Fast" : "Deep"})`
    const confirmed = window.confirm(zh
      ? `从已分析范围中删除${rangeLabel}？正在处理的任务会停止；逐页缓存、笔记和练习记录会保留。`
      : `Remove ${rangeLabel} from analyzed ranges? Processing will stop; reusable page analysis, notes, and practice history will remain.`)
    if (!confirmed) return
    setDeletingStudyPackId(pack.id)
    try {
      const result = await deleteEbookStudyPack(pack.id)
      const wasSelected = studyPack?.id === pack.id
      if (wasSelected) {
        studyPackAbortRef.current?.abort()
        studyPackSelectionRef.current += 1
        setStudyPack(null)
        setStudying(false)
        setExtraAnnotations([])
        setSelection(null)
      }
      const remaining = studyPackHistory.filter((candidate) => candidate.id !== pack.id)
      await refreshStudyPackHistory(remaining, { revalidate: false })
      void refreshStudyPackHistory()
      void refreshBooks()
      if (wasSelected) {
        const replacement = remaining.find((candidate) => candidate.id === result.nextStudyPackId)
          ?? remaining[0]
        if (replacement) void openStoredStudyPack(replacement)
      }
      toast.success(zh ? "已删除这段阅读范围。" : "Analyzed range deleted.")
    } catch (error) {
      toast.error(zh ? "无法删除这段阅读范围" : "Could not delete this analyzed range", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setDeletingStudyPackId(null)
    }
  }

  const captureSelection = useCallback((unit: EbookSentenceUnit, container: HTMLElement) => {
    const selected = window.getSelection()
    if (!selected || selected.rangeCount === 0 || selected.isCollapsed) return
    const sourceElement = container.querySelector<HTMLElement>("[data-ebook-source]")
    const selectedRange = selected.getRangeAt(0)
    if (!sourceElement || !sourceElement.contains(selectedRange.commonAncestorContainer)) return
    const text = selectedRange.toString()
    const normalized = text.trim()
    if (!normalized) return
    const prefixRange = document.createRange()
    prefixRange.selectNodeContents(sourceElement)
    prefixRange.setEnd(selectedRange.startContainer, selectedRange.startOffset)
    const start = prefixRange.toString().length + (text.length - text.trimStart().length)
    if (unit.sourceText.slice(start, start + normalized.length) !== normalized) return
    setSelection({ unit, startOffset: start, endOffset: start + normalized.length, text: normalized })
  }, [])

  async function analyzeSelection() {
    if (!selection || !studyPack) return
    setAddingSelection(true)
    try {
      const annotation = await createEbookAnnotation(studyPack.id, {
        unitId: selection.unit.unitId,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
      })
      setExtraAnnotations((rows) => rows.some((row) => row.id === annotation.id) ? rows : [...rows, annotation])
      setSelection(null)
      window.getSelection()?.removeAllRanges()
    } catch (error) {
      toast.error(zh ? "无法解析所选内容" : "Could not analyze the selection", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setAddingSelection(false)
    }
  }

  async function markUnfamiliar(annotation: EbookAnnotation) {
    try {
      const target = await markEbookAnnotationUnfamiliar(annotation.id)
      setTargetsByAnnotation((rows) => ({ ...rows, [annotation.id]: target }))
      toast.success(zh ? "已加入笔记和待验证弱点。" : "Added to Notebook and provisional weaknesses.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  async function beginPractice(annotation: EbookAnnotation) {
    try {
      const target = targetsByAnnotation[annotation.id] ?? await markEbookAnnotationUnfamiliar(annotation.id)
      setTargetsByAnnotation((rows) => ({ ...rows, [annotation.id]: target }))
      const session = await startEbookPractice(target.id)
      setPracticeTarget(target)
      setPractice(session)
      setReaderView("study")
      setPracticeAnswer("")
      setPracticeHint(false)
      setLastAttempt(null)
      window.setTimeout(() => document.getElementById("ebook-practice")?.scrollIntoView({ behavior: "smooth" }), 30)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  async function submitPracticeAnswer() {
    if (!practice || !practiceAnswer.trim()) return
    setPracticeSubmitting(true)
    try {
      const result = await submitEbookPractice(practice.id, {
        responseText: practiceAnswer.trim(),
        clientAttemptId: crypto.randomUUID(),
        hintUsed: practiceHint,
      })
      setPractice(result.session)
      setPracticeTarget(result.target)
      setTargetsByAnnotation((rows) => ({ ...rows, [result.target.annotationId]: result.target }))
      setLastAttempt(result.attempt)
      setPracticeAnswer("")
      setPracticeHint(false)
    } catch (error) {
      toast.error(zh ? "练习提交失败" : "Practice submission failed", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setPracticeSubmitting(false)
    }
  }

  if (!authChecked) {
    return <div className="flex min-h-64 items-center justify-center"><LoaderCircle className="size-7 animate-spin text-primary" /></div>
  }

  if (!authenticated) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader className="items-center text-center">
          <ShieldCheck className="size-10 text-primary" />
          <CardTitle>{zh ? "登录后使用私人书架" : "Sign in to use your private library"}</CardTitle>
          <CardDescription>{zh ? "书籍正文、笔记、弱点和阅读进度都需要绑定到你的账号。" : "Ebook text, notes, weaknesses, and reading progress are tied to your account."}</CardDescription>
        </CardHeader>
        <CardContent><Link className={cn(buttonVariants(), "w-full")} href={loginPageUrl("/input/ebooks")}>{zh ? "登录并继续" : "Sign in and continue"}</Link></CardContent>
      </Card>
    )
  }

  if (readingFocusActive && studyPack?.pages) {
    return <EbookReadingView
      pages={studyPack.pages}
      annotationsByUnit={annotationsByUnit}
      targetsByAnnotation={targetsByAnnotation}
      zh={zh}
      onUnfamiliar={markUnfamiliar}
      onPractice={beginPractice}
      onExit={() => setReaderView("study")}
    />
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-amber-500/10 p-6 sm:p-8">
        <Link href="/input" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{zh ? "返回 Input Lab" : "Back to Input Lab"}</Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="secondary"><BookMarked data-icon="inline-start" />{zh ? "私人电子书学习" : "Private ebook learning"}</Badge>
            <h1 className="mt-3 font-heading text-3xl font-bold">{zh ? "把英文书变成可练会的语言" : "Turn an English book into usable language"}</h1>
            <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">{zh ? "每次学习连续 1–15 页：逐句对照、重点精讲、标记不熟悉，再通过三步训练独立使用。" : "Study 1–15 consecutive pages with sentence counterparts, focused explanations, unfamiliar-item marking, and a three-step production path."}</p>
          </div>
          <Badge variant="outline" className="w-fit"><ShieldCheck data-icon="inline-start" />{zh ? "原文件解析后删除" : "Original upload deleted after parsing"}</Badge>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="size-5 text-primary" />{zh ? "导入电子书" : "Import ebook"}</CardTitle><CardDescription>{zh ? "支持 EPUB 和带可选择文字的 PDF，不设置文件大小上限。" : "EPUB and selectable-text PDF, with no file-size cap."}</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {zh ? "每本书的对照语言" : "Counterpart language"}
                <select className="h-10 rounded-lg border border-input bg-background px-3" value={uploadLanguage} onChange={(event) => setUploadLanguage(event.target.value as EbookComparisonLanguage)}>
                  <option value="zh-CN">简体中文</option>
                  <option value="en">Plain English</option>
                </select>
              </label>
              <label className="flex items-start gap-3 rounded-xl border p-3 text-xs leading-relaxed text-muted-foreground">
                <Checkbox checked={rightsConfirmed} onCheckedChange={(checked) => setRightsConfirmed(checked === true)} />
                <span>{zh ? "我确认自己拥有处理该文件的权利，并理解书籍内容不会公开分享。" : "I confirm I have the right to process this file and understand its content will not be publicly shared."}</span>
              </label>
              <input ref={fileInput} type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(file) }} />
              <div
                className={cn("flex flex-col gap-2 rounded-xl border border-dashed p-3 text-center transition-colors", draggingFile && "border-primary bg-primary/5")}
                onDragEnter={(event) => { event.preventDefault(); setDraggingFile(true) }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingFile(false) }}
                onDrop={(event) => {
                  event.preventDefault()
                  setDraggingFile(false)
                  const file = event.dataTransfer.files?.[0]
                  if (file) void handleUpload(file)
                }}
              >
                <p className="text-xs text-muted-foreground">{zh ? "拖放 EPUB / PDF 到这里" : "Drop an EPUB / PDF here"}</p>
                <Button disabled={uploading || !rightsConfirmed} onClick={() => fileInput.current?.click()}>{uploading ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <FileUp data-icon="inline-start" />}{uploading ? (zh ? "正在上传…" : "Uploading…") : (zh ? "选择电子书" : "Choose ebook")}</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Library className="size-5 text-primary" />{zh ? "我的书架" : "My library"}</CardTitle><CardDescription>{books.length} {zh ? "本书" : "books"}</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {books.length === 0 ? <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">{zh ? "导入第一本英文电子书开始学习。" : "Import your first English ebook to begin."}</p> : books.map((book) => (
                <div key={book.id} className={cn("group relative flex items-start gap-2 rounded-xl border p-3", activeBook?.id === book.id && "border-primary/45 bg-primary/5")}>
                  <button className="min-w-0 flex-1 text-left" onClick={() => void openBook(book)}>
                    <span className="flex items-center gap-2 text-sm font-medium"><BookOpen className="size-4 shrink-0 text-primary" /><span className="truncate">{book.title}</span></span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><span>{book.format.toUpperCase()}</span><span>·</span><span>{book.status === "ready" ? `${book.pageCount} ${zh ? "页" : "pages"}` : book.status === "processing" ? (zh ? "解析中" : "Parsing") : (zh ? "失败" : "Failed")}</span></span>
                  </button>
                  <Button variant="ghost" size="icon-sm" aria-label={zh ? "删除" : "Delete"} onClick={() => void removeBook(book)}><Trash2 /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0">
          {!activeBook ? (
            <Card className="min-h-[420px]"><CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center"><BookOpen className="size-12 text-muted-foreground/35" /><h2 className="font-heading text-xl font-semibold">{zh ? "选择书架中的一本书" : "Choose a book from your library"}</h2><p className="max-w-md text-sm text-muted-foreground">{zh ? "选择连续页段后，系统只分析这次学习需要的内容。" : "Choose a consecutive range and the app will analyze only what this session needs."}</p></CardContent></Card>
          ) : activeBook.status !== "ready" ? (
            <Card><CardHeader><CardTitle>{activeBook.title}</CardTitle><CardDescription>{activeBook.status === "processing" ? (zh ? "正在建立章节和稳定页码…" : "Building chapters and stable pages…") : activeBook.error}</CardDescription></CardHeader><CardContent>{activeBook.status === "processing" ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{zh ? "你可以离开此页面，书籍会留在书架中。" : "You can leave this page; the book will remain in your library."}</div> : <Button variant="outline" onClick={() => fileInput.current?.click()}>{zh ? "重新上传" : "Upload again"}</Button>}</CardContent></Card>
          ) : (
            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="text-xl">{activeBook.title}</CardTitle><CardDescription>{[activeBook.author, `${activeBook.pageCount} ${zh ? "页" : "pages"}`, `${activeBook.wordCount.toLocaleString()} ${zh ? "词" : "words"}`].filter(Boolean).join(" · ")}</CardDescription></div><label className="flex items-center gap-2 text-xs text-muted-foreground"><Languages className="size-4" /><select className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground" value={activeBook.comparisonLanguage} onChange={(event) => void changeLanguage(event.target.value as EbookComparisonLanguage)}><option value="zh-CN">简体中文</option><option value="en">Plain English</option></select></label></div></CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
                    <label className="text-sm font-medium">{zh ? "起始页" : "Start page"}<Input className="mt-1.5" type="number" min={1} max={activeBook.pageCount} value={startPage} onChange={(event) => setRangeStart(Number(event.target.value))} /></label>
                    <label className="text-sm font-medium">{zh ? "结束页" : "End page"}<Input className="mt-1.5" type="number" min={startPage} max={Math.min(activeBook.pageCount, startPage + 14)} value={endPage} onChange={(event) => setRangeEnd(Number(event.target.value))} /></label>
                    <label className="text-sm font-medium">{zh ? "分析速度" : "Analysis mode"}<select className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={studyTier} onChange={(event) => setStudyTier(event.target.value as EbookModelTier)}><option value="fast">{zh ? "Fast · 更快" : "Fast · quicker"}</option><option value="deep">{zh ? "Deep · 更详细" : "Deep · more detailed"}</option></select></label>
                    <Button size="lg" disabled={studying} onClick={() => void beginStudy()}>{studying ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}{studying ? (zh ? "生成中…" : "Preparing…") : (zh ? `学习 ${endPage - startPage + 1} 页` : `Study ${endPage - startPage + 1} pages`)}</Button>
                  </div>
                  {(loadingStudyPackHistory || studyPackHistory.length > 0) ? (
                    <section className="rounded-2xl border bg-background p-3" aria-labelledby="ebook-analyzed-ranges">
                      <div className="flex items-center justify-between gap-3">
                        <h3 id="ebook-analyzed-ranges" className="flex items-center gap-2 text-sm font-medium">
                          <Clock3 className="size-4 text-primary" />
                          {zh ? "已分析的阅读范围" : "Analyzed reading ranges"}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {zh ? "可以随时切换，不会覆盖" : "Switch anytime; nothing is overwritten"}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {loadingStudyPackHistory && studyPackHistory.length === 0 ? (
                          <span className="flex min-h-10 items-center gap-2 px-2 text-xs text-muted-foreground">
                            <LoaderCircle className="size-3.5 animate-spin" />
                            {zh ? "正在读取…" : "Loading…"}
                          </span>
                        ) : studyPackHistory.map((pack) => {
                          const selected = studyPack?.id === pack.id
                          const rangeLabel = zh
                            ? `第 ${pack.startPage}–${pack.endPage} 页`
                            : `Pages ${pack.startPage}–${pack.endPage}`
                          const modeLabel = pack.comparisonMode === "translation"
                            ? (zh ? "中文" : "Chinese")
                            : (zh ? "简明英文" : "Plain English")
                          return (
                            <div
                              key={pack.id}
                              className={cn(
                                "flex min-w-fit items-stretch rounded-xl border outline-none transition hover:border-primary/40 hover:bg-primary/5",
                                selected && "border-primary/50 bg-primary/8",
                              )}
                            >
                              <button
                                type="button"
                                aria-pressed={selected}
                                onClick={() => void openStoredStudyPack(pack)}
                                className="flex items-center gap-2 rounded-l-xl px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                              >
                                {pack.status === "processing"
                                  ? <LoaderCircle className="size-4 animate-spin text-primary" />
                                  : pack.status === "ready"
                                    ? <CheckCircle2 className="size-4 text-primary" />
                                    : <span className="size-2 rounded-full bg-amber-500" />}
                                <span>
                                  <span className="block text-sm font-medium">{rangeLabel}</span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {pack.modelTier === "fast" ? "Fast" : "Deep"} · {modeLabel} · {pack.completedPageCount}/{pack.totalPageCount}
                                  </span>
                                </span>
                              </button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={deletingStudyPackId !== null}
                                aria-label={zh ? `删除${rangeLabel}` : `Delete ${rangeLabel}`}
                                title={zh ? "删除这段阅读范围" : "Delete this analyzed range"}
                                onClick={() => void removeStudyPack(pack)}
                                className="my-1 mr-1 self-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                {deletingStudyPackId === pack.id
                                  ? <LoaderCircle className="animate-spin" />
                                  : <Trash2 />}
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ) : null}
                  {studyPack?.status === "processing" ? <div className="space-y-2"><div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{zh ? "逐页翻译和批注" : "Translating and annotating pages"} · {studyPack.modelTier === "fast" ? "Fast" : "Deep"}</span><div className="flex items-center gap-2"><span>{studyPack.completedPageCount}/{studyPack.totalPageCount}</span>{!studying ? <Button variant="outline" size="sm" onClick={() => void beginStudy(true)}>{zh ? "继续处理" : "Resume"}</Button> : null}</div></div><Progress value={(studyPack.completedPageCount / studyPack.totalPageCount) * 100} /><p className="text-xs text-muted-foreground">{zh ? "每完成一页就会显示在下方，其余页面继续在后台生成。" : "Each completed page appears below while the remaining pages continue in the background."}</p></div> : null}
                  {studyPack?.status === "failed" ? <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{zh ? "部分页面没有生成成功" : "Some pages were not prepared"}</p><p className="text-xs text-muted-foreground">{studyPack.failedPages.length ? `${zh ? "失败页" : "Failed pages"}: ${studyPack.failedPages.join(", ")}` : studyPack.error}</p></div><Button variant="outline" size="sm" onClick={() => void beginStudy(true)}>{zh ? "安全重试" : "Retry safely"}</Button></div> : null}
                </CardContent>
              </Card>

              {studyPack && studyPack.pages && studyPack.pages.length > 0 ? <>
                <Card className="z-20 border-primary/20 bg-background/95 shadow-sm backdrop-blur sm:sticky sm:top-3">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="flex rounded-xl bg-muted p-1" role="tablist" aria-label={zh ? "阅读视图" : "Reader view"}>
                      <Button size="sm" variant={readerView === "reading" ? "default" : "ghost"} role="tab" aria-selected={readerView === "reading"} onClick={() => setReaderView("reading")}><BookOpen />{zh ? "阅读模式" : "Reading"}</Button>
                      <Button size="sm" variant={readerView === "study" ? "default" : "ghost"} role="tab" aria-selected={readerView === "study"} onClick={() => setReaderView("study")}><GraduationCap />{zh ? "学习模式" : "Study"}</Button>
                    </div>
                  </CardContent>
                </Card>

                <section className="flex flex-col gap-6">
                  {studyPack.pages.map((page) => (
                    <Card key={page.pageNumber} className="overflow-hidden">
                      <CardHeader className="border-b bg-muted/15"><div className="flex items-center justify-between gap-3"><div><CardTitle>{zh ? `第 ${page.pageNumber} 页` : `Page ${page.pageNumber}`}</CardTitle>{page.chapterTitle ? <CardDescription>{page.chapterTitle}</CardDescription> : null}</div><div className="flex items-center gap-2"><Badge variant="secondary">{studyPack.modelTier === "fast" ? "Fast" : "Deep"}</Badge><Badge variant="outline">{studyPack.comparisonMode === "translation" ? (zh ? "中文对照" : "Chinese translation") : "Plain English"}</Badge></div></div></CardHeader>
                      <CardContent className="divide-y p-0">
                        {page.units.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{zh ? "本页没有可识别文字。" : "No readable text on this page."}</p> : page.units.map((unit) => (
                          <article key={unit.unitId} className="grid gap-0 lg:grid-cols-2">
                            <div className="border-b p-5 leading-8 lg:border-r lg:border-b-0" onMouseUp={(event) => captureSelection(unit, event.currentTarget)}>
                              <p data-ebook-source className="select-text text-[15px] text-foreground"><HighlightedSource text={unit.sourceText} annotations={annotationsByUnit[unit.unitId] ?? []} /></p>
                              {selection?.unit.unitId === unit.unitId ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-primary/8 p-2 text-xs"><span className="line-clamp-1 flex-1">“{selection.text}”</span><Button size="sm" onClick={() => void analyzeSelection()} disabled={addingSelection}>{addingSelection ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{zh ? "详细解析" : "Explain selection"}</Button></div> : null}
                            </div>
                            <div className="border-b bg-primary/[0.025] p-5 leading-8 lg:border-b-0"><p className="text-[15px] text-muted-foreground">{unit.counterpartText}</p></div>
                            {(annotationsByUnit[unit.unitId]?.length ?? 0) > 0 ? <div className="col-span-full flex flex-col gap-3 border-t bg-muted/10 p-4">{annotationsByUnit[unit.unitId].map((annotation) => <AnnotationCard key={annotation.id} annotation={annotation} target={targetsByAnnotation[annotation.id]} zh={zh} onUnfamiliar={markUnfamiliar} onPractice={beginPractice} />)}</div> : null}
                          </article>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </section>
              </> : null}

              {practice ? <EbookPracticePanel id="ebook-practice" session={practice} target={practiceTarget} answer={practiceAnswer} setAnswer={setPracticeAnswer} hint={practiceHint} setHint={setPracticeHint} submitting={practiceSubmitting} lastAttempt={lastAttempt} zh={zh} onSubmit={submitPracticeAnswer} onClose={() => { setPractice(null); setPracticeTarget(null); setLastAttempt(null) }} /> : null}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function EbookReadingView({
  pages,
  annotationsByUnit,
  targetsByAnnotation,
  zh,
  onUnfamiliar,
  onPractice,
  onExit,
}: {
  pages: EbookStudyPage[]
  annotationsByUnit: Record<string, EbookAnnotation[]>
  targetsByAnnotation: Record<string, EbookLearningTarget>
  zh: boolean
  onUnfamiliar: (annotation: EbookAnnotation) => Promise<void>
  onPractice: (annotation: EbookAnnotation) => Promise<void>
  onExit: () => void
}) {
  const firstPage = pages[0]?.pageNumber
  const lastPage = pages.at(-1)?.pageNumber
  return (
    <section
      data-testid="ebook-reading-focus"
      aria-label={zh ? "原文、译文和批注阅读模式" : "Original, translation and annotations reading mode"}
      aria-keyshortcuts="Escape"
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden overscroll-contain bg-background"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-background/90 px-4 py-2.5 backdrop-blur sm:px-6">
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="size-4 shrink-0 text-primary" />
          <span className="truncate font-medium text-foreground">{zh ? "专注阅读" : "Focused reading"}</span>
          {firstPage && lastPage ? <span className="shrink-0 text-xs">{zh ? `第 ${firstPage}–${lastPage} 页` : `Pages ${firstPage}–${lastPage}`}</span> : null}
        </span>
        <Button variant="outline" size="sm" onClick={onExit} className="shrink-0">
          <X data-icon="inline-start" />
          {zh ? "退出阅读（Esc）" : "Exit (Esc)"}
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
          {pages.map((page) => (
            <section key={page.pageNumber} aria-label={zh ? `第 ${page.pageNumber} 页` : `Page ${page.pageNumber}`}>
              <div className="mb-6 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
                <span className="h-px flex-1 bg-border" />
                <span className="shrink-0 font-medium uppercase tracking-wide">
                  {zh ? `第 ${page.pageNumber} 页` : `Page ${page.pageNumber}`}
                  {page.chapterTitle ? ` · ${page.chapterTitle}` : ""}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-col gap-6">
                {page.units.map((unit) => {
                  const unitAnnotations = annotationsByUnit[unit.unitId] ?? []
                  return (
                    <article key={unit.unitId} className="flex flex-col gap-1.5">
                      <p className="text-base leading-8 text-foreground sm:text-[17px]">
                        <HighlightedSource text={unit.sourceText} annotations={unitAnnotations} />
                      </p>
                      <p className="border-l-2 border-primary/25 pl-3 text-[15px] leading-7 text-muted-foreground">
                        {unit.counterpartText}
                      </p>
                      {unitAnnotations.length > 0 ? (
                        <div className="mt-2.5 flex flex-col gap-3">
                          {unitAnnotations.map((annotation) => <AnnotationCard
                            key={annotation.id}
                            annotation={annotation}
                            target={targetsByAnnotation[annotation.id]}
                            zh={zh}
                            initiallyOpen
                            onUnfamiliar={onUnfamiliar}
                            onPractice={onPractice}
                          />)}
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

function HighlightedSource({ text, annotations }: { text: string; annotations: EbookAnnotation[] }) {
  const ranges = annotations
    .filter((annotation) => annotation.startOffset >= 0 && annotation.endOffset <= text.length && annotation.endOffset > annotation.startOffset)
    .sort((left, right) => left.startOffset - right.startOffset || right.endOffset - left.endOffset)
    .reduce<Array<{ start: number; end: number; labels: string[] }>>((merged, annotation) => {
      const previous = merged.at(-1)
      if (previous && annotation.startOffset <= previous.end) {
        previous.end = Math.max(previous.end, annotation.endOffset)
        previous.labels.push(annotation.title)
      } else {
        merged.push({ start: annotation.startOffset, end: annotation.endOffset, labels: [annotation.title] })
      }
      return merged
    }, [])
  if (!ranges.length) return text
  let cursor = 0
  return ranges.map((range, index) => {
    const before = text.slice(cursor, range.start)
    const selected = text.slice(range.start, range.end)
    cursor = range.end
    return <span key={`${range.start}-${range.end}`}>
      {before}
      <mark className="rounded bg-amber-200/65 px-0.5 text-inherit dark:bg-amber-500/25" title={range.labels.join(" · ")}>{selected}</mark>
      {index === ranges.length - 1 ? text.slice(cursor) : null}
    </span>
  })
}

function AnnotationCard({ annotation, target, zh, initiallyOpen = false, onUnfamiliar, onPractice }: { annotation: EbookAnnotation; target?: EbookLearningTarget; zh: boolean; initiallyOpen?: boolean; onUnfamiliar: (annotation: EbookAnnotation) => Promise<void>; onPractice: (annotation: EbookAnnotation) => Promise<void> }) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <div className="rounded-xl border bg-background p-4">
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen((value) => !value)}><div><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{annotation.kind.replace("_", " ")}</Badge>{target ? <Badge variant="outline"><NotebookPen data-icon="inline-start" />{target.status}</Badge> : null}</div><h4 className="mt-2 font-heading text-lg font-semibold">{annotation.selectedText}</h4><p className="mt-1 text-sm text-muted-foreground">{annotation.meaningInContext}</p></div><ChevronDown className={cn("mt-1 size-5 shrink-0 transition-transform", open && "rotate-180")} /></button>
      {open ? <div className="mt-4 grid gap-3 border-t pt-4 text-sm md:grid-cols-2"><Explanation label={zh ? "结构" : "Structure"} value={annotation.structure} /><Explanation label={zh ? "用法" : "Usage"} value={annotation.usage} /><Explanation label={zh ? "可迁移模板" : "Reusable pattern"} value={annotation.patternTemplate} /><Explanation label={zh ? "语域" : "Register"} value={annotation.usageRegister} />{annotation.clauseBreakdown.length > 0 ? <Explanation label={zh ? "从句分层" : "Clause breakdown"} value={annotation.clauseBreakdown.join(" → ")} /> : null}{annotation.simplifiedParaphrase ? <Explanation label={zh ? "简化释义" : "Simplified meaning"} value={annotation.simplifiedParaphrase} /> : null}{annotation.collocations.length > 0 ? <Explanation label={zh ? "搭配" : "Collocations"} value={annotation.collocations.join(" · ")} /> : null}{annotation.commonPitfalls.length > 0 ? <Explanation label={zh ? "常见错误" : "Pitfalls"} value={annotation.commonPitfalls.join(" · ")} /> : null}{annotation.examples.length > 0 ? <Explanation label={zh ? "新例句" : "New examples"} value={annotation.examples.join(" / ")} /> : null}</div> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" disabled={Boolean(target)} onClick={() => void onUnfamiliar(annotation)}>{target ? <CheckCircle2 /> : <NotebookPen />}{target ? (zh ? "已加入笔记" : "Saved") : (zh ? "我不熟悉" : "Unfamiliar")}</Button><Button size="sm" onClick={() => void onPractice(annotation)}><PlayCircle />{zh ? "立即练习" : "Practice now"}</Button></div>
    </div>
  )
}

function Explanation({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p><p className="mt-1 leading-relaxed text-muted-foreground">{value}</p></div>
}

function EbookPracticePanel({ id, session, target, answer, setAnswer, hint, setHint, submitting, lastAttempt, zh, onSubmit, onClose }: { id: string; session: EbookPracticeSession; target: EbookLearningTarget | null; answer: string; setAnswer: (value: string) => void; hint: boolean; setHint: (value: boolean) => void; submitting: boolean; lastAttempt: EbookPracticeAttempt | null; zh: boolean; onSubmit: () => Promise<void>; onClose: () => void }) {
  const exercise = session.exercise
  return (
    <Card id={id} className="border-primary/30 bg-primary/5">
      <CardHeader><div className="flex items-start justify-between gap-3"><div><Badge><GraduationCap data-icon="inline-start" />{session.delayedReview ? (zh ? "延迟复测" : "Delayed review") : `${zh ? "第" : "Step"} ${session.currentStep}/3`}</Badge><CardTitle className="mt-3">{target?.expression ?? exercise?.targetExpression}</CardTitle><CardDescription>{exercise?.title}</CardDescription></div><Button variant="ghost" size="sm" onClick={onClose}>{zh ? "关闭" : "Close"}</Button></div></CardHeader>
      <CardContent className="flex flex-col gap-4">
        {session.status === "complete" ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"><p className="font-medium">{target?.status === "mastered" ? (zh ? "已通过延迟独立复测" : "Delayed independent review passed") : (zh ? "本轮完成，目标已进入后续复习" : "Session complete; the target is scheduled for review")}</p>{target?.dueAt ? <p className="mt-1 text-sm text-muted-foreground">{zh ? "下次复习：" : "Next review: "}{new Date(target.dueAt).toLocaleString()}</p> : null}</div> : exercise ? <><p className="rounded-xl bg-background p-4 leading-relaxed">{exercise.question}</p>{exercise.sourceSentenceVisible && exercise.sourceText ? <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">{exercise.sourceText}</blockquote> : null}<Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={zh ? "用英文完成这个步骤…" : "Complete this step in English…"} className="min-h-32 bg-background" disabled={submitting} /><label className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox checked={hint} onCheckedChange={(checked) => setHint(checked === true)} />{zh ? "我查看/使用了提示（会记为辅助完成）" : "I used a hint (records assisted completion)"}</label><Button onClick={() => void onSubmit()} disabled={!answer.trim() || submitting}>{submitting ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}{zh ? "提交这一步" : "Submit this step"}</Button></> : null}
        {lastAttempt ? <div className={cn("rounded-xl border p-3 text-sm", lastAttempt.passed ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10")}><p className="font-medium">{lastAttempt.score}/100 · {lastAttempt.passed ? (zh ? "达到要求" : "Passed") : (zh ? "再试一次" : "Try again")}</p><p className="mt-1 text-muted-foreground">{lastAttempt.feedback}</p>{!lastAttempt.passed ? <p className="mt-2 text-xs text-muted-foreground">{lastAttempt.correctedAnswer}</p> : null}</div> : null}
      </CardContent>
    </Card>
  )
}
