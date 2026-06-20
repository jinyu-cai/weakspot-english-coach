# v0.dev Prompt — WeakSpot English Coach (frontend)

Paste everything in the **PROMPT** block below into v0.dev to generate the UI.
After v0 generates it, export/download the project into `apps/web/`, then drop in
the integration kit from `apps/web/lib/` (see `apps/web/README.md`) and switch
the pages from mock data to the real `api-client.ts` calls.

> Why v0: the hackathon **requires** the frontend to be built with Vercel v0 and
> deployed on Vercel. Keep the v0 project link + Team ID for submission.

---

## PROMPT

Build a polished, production-quality **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** web app called **"WeakSpot English Coach"**.

**Product:** An adaptive English-learning coach for Chinese-speaking learners. Unlike a generic chatbot, it *discovers* what the learner needs to practice: the user writes English, the app diagnoses specific weaknesses (verb tense, repetitive vocabulary, clarity, register, etc.), builds an evolving "weakness profile," and turns those real mistakes into a personalized plan and targeted exercises. Tagline: **"Instead of asking what you want to practice, it discovers what you need to practice."**

**Design language:**
- Modern education-SaaS aesthetic: clean, calm, lots of whitespace, rounded-2xl cards, soft shadows.
- Primary accent: indigo/violet (`indigo-600`). Success: emerald. Warning: amber. Danger: red.
- Font: Inter. Support light and dark mode.
- Use `lucide-react` icons and `recharts` for charts.
- Bilingual by design: **UI chrome/labels in English**, but **learner-facing feedback content is in Simplified Chinese** (it comes from the API in Chinese — render it as-is).

**App shell:** A fixed left sidebar (collapsible on mobile into a sheet) with the brand and nav items: **Diagnose (/)**, **Dashboard (/dashboard)**, **Plan (/plan)**, **Practice (/practice)**, **History (/history)**. Show the active route. Top-right: a small "Demo learner" badge and a dark-mode toggle.

**Pages:**

1. **/ (Diagnose)** — the hero page.
   - A large `Textarea` pre-filled with a sample paragraph, an "Analyze My English" primary button, and a char counter.
   - On submit, show a loading state (skeletons), then a **diagnostic report**:
     - Header row: a big **CEFR level** badge (A1–C2), an **overall score** ring/progress (0–100), and a one-line Chinese `summaryZh`.
     - Two columns: **Strengths** (`strengthsZh`, green checks) and **Weaknesses** (`weaknessesZh`, amber).
     - **Corrected text** card (show `correctedText`).
     - **Error cards** list — THIS IS THE STAR. Each `EnglishError` card shows: a category chip with a severity color (low/medium/high), the `originalText` (strikethrough/red) → `correctedText` (green), the Chinese `explanationZh`, a collapsible `microLessonZh`, and a small "练习目标: {practiceGoal}" footer.
     - A "Recommended next actions" checklist (`recommendedNextActionsZh`).

2. **/dashboard** — the learner profile / weakness model.
   - Top stat cards: estimated CEFR level, total submissions, total practice attempts.
   - **Weakness radar/bar chart** (recharts): x = skill `zhLabel`, value = `mastery` (0–100). Lower bars = weaker skills; color bars red<50, amber<75, emerald otherwise. This is the visual proof of the adaptive model.
   - A "Weakest skills" list (sorted ascending by mastery) with mastery %, error/correct counts, and a "Practice this" button linking to /practice.
   - A "Recent mistakes" compact list.

3. **/plan** — 7-day personalized plan.
   - If no plan: an empty state with a "Generate 7-Day Plan" button.
   - When a plan exists: a vertical timeline of 7 day-cards. Each day shows `goalZh`, target skill chips, and 2–3 task rows with a checkbox (`completed`), `titleZh`, `descriptionZh`, a practiceType chip, and "~{estimatedMinutes} min".

4. **/practice** — targeted practice loop.
   - A "Generate Practice" button (optionally a skill picker). Shows the generated exercise card: Chinese instruction `promptZh`, the English `question`, and an answer `Textarea` with "Submit Answer".
   - After submit: a graded result card — correct/incorrect badge, score, Chinese `feedbackZh`, the `correctedAnswer`, and a small "mastery {delta}" indicator. Then a "Next exercise" button.

5. **/history** — recent submissions and errors in two tabs/lists with timestamps.

**Components to create:** `app-shell`, `nav-sidebar`, `diagnostic-input`, `diagnostic-report`, `error-card`, `skill-bar-chart`, `weakness-radar`, `learning-plan-card`, `practice-card`, `submission-history`, `empty-state`, `loading-state`, `cefr-badge`, `score-ring`.

**Data layer:** Create a `lib/api-client.ts` seam and a `lib/types.ts` with the TypeScript interfaces below. For the v0 preview, populate each page from **mock data shaped exactly like these types** (so it renders without a backend), but keep all data access behind functions like `diagnose()`, `getProfile()`, `getPlan()`, `generatePlan()`, `generatePractice()`, `submitPractice()`, `getHistory()` so they can be swapped to real `fetch` calls later. Read the API base from `process.env.NEXT_PUBLIC_API_BASE_URL`.

**TypeScript types (use these exactly):**

```ts
type CEFRLevel = "A1"|"A2"|"B1"|"B2"|"C1"|"C2";
type Severity = "low"|"medium"|"high";
type PracticeType = "fix_sentence"|"fill_blank"|"rewrite_sentence";

interface LearnerProfile { userId:string; nativeLanguage:string; targetLanguage:"English"; estimatedLevel:CEFRLevel; totalSubmissions:number; totalPracticeAttempts:number; createdAt:string; updatedAt:string; }
interface SkillState { userId:string; skillCode:string; label:string; zhLabel:string; mastery:number; errorCount:number; correctCount:number; lastSeenAt?:string|null; lastPracticedAt?:string|null; updatedAt:string; }
interface EnglishError { id:string; userId:string; submissionId:string; code:string; category:string; severity:Severity; originalText:string; correctedText:string; explanationZh:string; microLessonZh:string; practiceGoal:string; createdAt:string; }
interface SkillUpdate { skillCode:string; label:string; zhLabel:string; masteryDelta:number; evidenceZh:string; }
interface Submission { id:string; userId:string; mode:"writing"|"chat"|"practice"; originalText:string; correctedText?:string|null; cefrEstimate?:CEFRLevel|null; summaryZh?:string|null; createdAt:string; }
interface DiagnosticResult { cefrEstimate:CEFRLevel; overallScore:number; summaryZh:string; strengthsZh:string[]; weaknessesZh:string[]; correctedText:string; errors:EnglishError[]; skillUpdates:SkillUpdate[]; recommendedNextActionsZh:string[]; }
interface LearningPlanTask { id:string; titleZh:string; descriptionZh:string; practiceType:PracticeType; estimatedMinutes:number; completed:boolean; }
interface LearningPlanDay { day:number; goalZh:string; targetSkillCodes:string[]; tasks:LearningPlanTask[]; }
interface LearningPlan { id:string; userId:string; title:string; days:LearningPlanDay[]; createdAt:string; updatedAt:string; }
interface PracticeExercise { id:string; userId:string; type:PracticeType; targetSkillCode:string; promptZh:string; question:string; answer?:string; explanationZh?:string; createdAt:string; }
interface PracticeGrade { isCorrect:boolean; score:number; feedbackZh:string; correctedAnswer:string; skillMasteryDelta:number; }
```

**API contract** (the real backend; base = `NEXT_PUBLIC_API_BASE_URL`, all under `/api/v1`):
- `POST /diagnose` body `{ userId, text }` → `{ submission, diagnostic, updatedSkills, profile }`
- `GET /profile/{userId}` → `{ profile, skills, recentErrors, recentSubmissions }`
- `POST /plan` body `{ userId }` → `{ plan }`; `GET /plan/{userId}` → `{ plan|null }`
- `POST /practice/generate` body `{ userId, targetSkillCode? }` → `{ exercise }`
- `POST /practice/submit` body `{ userId, exerciseId, userAnswer }` → `{ grade, attempt, updatedSkill }`
- `GET /history/{userId}` → `{ submissions, errors }`

Make it responsive, accessible, and genuinely demo-ready. The diagnostic report and the dashboard weakness chart are the two screens that must look impressive.
```
