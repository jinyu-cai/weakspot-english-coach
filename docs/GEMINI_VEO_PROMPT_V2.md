# Gemini Veo 3 — WeakSpot English Coach Demo Prompt (V2)
# H0 Hackathon · All features · 2:30 target

## How to use this prompt

**If you have screen recordings (recommended path):**
1. Open Google AI Studio (aistudio.google.com)
2. Upload all 3 `.mov` files and 2 `.png` screenshots from the `/demo` folder
3. Paste the "Gemini Multimodal Compilation Prompt" below
4. Let Gemini generate scene-by-scene editing instructions + narration timing
5. Compile in iMovie / CapCut / DaVinci Resolve using the instructions

**If you want Veo 3 to generate a synthetic video:**
1. Open Google DeepMind / Vertex AI Veo interface
2. Paste the "Veo 3 Generation Prompt" below as your text-to-video prompt
3. Veo will generate a stylized product demo (not real screen recording)

---

## GEMINI MULTIMODAL COMPILATION PROMPT
*Paste this into AI Studio alongside your uploaded video files*

```
You are a video editor helping compile a 2:30 hackathon demo for "WeakSpot English Coach",
an adaptive AI English learning app. I am uploading these source files:

1. Diagonse->notebook->history->dashboard->practice->plan.mov  — main feature flow
2. Chat.mov — chat and speaking practice feature
3. Login function.mov — login/auth (use only if needed for intro context)
4. 7Day-plan.png — screenshot of the 7-day study plan
5. Import AI history to generate personal weaknesses.png — AI history import screenshot

Your job:
1. Identify which timestamp ranges in each video correspond to these scenes (describe what you see):
   - Diagnose input textarea and "Analyze" button
   - Diagnose results: CEFR badge, score, Strengths section, Weaknesses/error cards, corrected reference text
   - Notebook page showing saved errors
   - History page showing past submissions
   - Dashboard with radar chart and skill bars
   - Practice exercise interaction (submitting answer, seeing grade)
   - Plan page with 7-day cards
   - Chat text mode conversation
   - Chat speaking mode with word prediction panel (if visible)

2. For each scene, output:
   - Source file name
   - Start timestamp → End timestamp
   - Recommended crop/zoom (e.g., "zoom into error cards in lower panel")
   - Which narration line from the script to overlay (use the NARRATION below)

3. Flag any scenes that are MISSING from my materials so I know what to re-record.

NARRATION (match each segment to the scenes above):

Scene 1 (Hook, 0:00–0:18):
"Most AI English tutors are stateless. Every session starts from zero, and you have to already know what to ask.
WeakSpot is different — it discovers what you need to practice by analyzing your actual writing
and building a persistent profile of your weaknesses over time."

Scene 2 (Diagnose, 0:18–0:50):
"A learner pastes any English they've written. WeakSpot analyzes it against 11 error categories:
verb tense, articles, prepositions, word choice, register, sentence variety, clarity, transitions,
repetition, Chinese-English transfer patterns, and completeness.
The result includes a CEFR level estimate, a score, and two sections:
Strengths — what they already do well — and Weaknesses — specific errors with micro-lessons.
Below that, a corrected reference version shows exactly how a fluent speaker would say the same thing."

Scene 3 (Notebook + History, 0:50–1:05):
"Errors can be saved to the Notebook for later review.
In History, every past submission is permanently logged — learners can revisit any writing
and see exactly what mistakes they made."

Scene 4 (Dashboard, 1:05–1:22):
"The Dashboard is a live view of the learner's DynamoDB weakness profile.
Every diagnosis writes structured error data into Amazon DynamoDB, updating skill mastery scores.
The radar chart shows where they're weakest — and it gets more accurate with every submission."

Scene 5 (Plan, 1:22–1:42):
"With one click, WeakSpot generates a personalized 7-Day Study Plan pulled from the DynamoDB weakness profile.
The weakest skills come first. The plan updates as the learner improves."

Scene 6 (Practice, 1:42–2:00):
"Practice exercises are generated on demand from the weakness profile.
The learner submits their answer, the AI grades it, and the attempt updates skill mastery in DynamoDB."

Scene 7 (Chat + Speaking, 2:00–2:25):
"In text mode, after each chat session, WeakSpot analyzes everything the learner typed
and writes all errors into the weakness library automatically.
In speaking mode, when a learner hesitates mid-sentence, the system uses function calling
to predict their intended words and surfaces vocabulary scaffolds in real time."

Scene 8 (DynamoDB, 2:25–2:38):
"One DynamoDB table. Single-table design. Partition key: USER plus the learner ID.
Sort keys encode every entity type — profile, skills, submissions, errors, plans, exercises, attempts.
Serverless, pay-per-request, zero cold starts."

Scene 9 (Closing, 2:38–2:50):
"Diagnose → Profile → Plan → Practice → Grade → Update. Every interaction tightens the model.
WeakSpot English Coach — built with Vercel v0, FastAPI, DeepSeek, and Amazon DynamoDB."

Output format: a numbered edit list I can follow in iMovie or DaVinci Resolve.
```

---

## VEO 3 GENERATION PROMPT
*Use this if you want Veo to generate a synthetic stylized demo (no real screen recordings needed)*

```
Create a 2-minute 30-second polished product demo video for "WeakSpot English Coach",
an adaptive AI-powered English learning web application.

Style: Clean, modern SaaS product demo. Dark-mode web UI on a MacBook browser. 
Smooth cursor movements. Crisp 16:9 1080p. Minimal on-screen text overlays. 
No stock footage, no abstract animations, no talking head. Pure screen demo aesthetic.
Color palette: deep navy/charcoal background, teal/cyan accent for skill indicators,
amber/red for error highlights, green for strengths.

Scene 1 (0:00–0:18) — Hook
Show: Modern web app home page. Textarea containing a paragraph of imperfect English.
Cursor hovers over a prominent "Analyze My English" button.
Text overlay (top left): "Not a chatbot. An adaptive weakness tracker."
Voiceover: "Most AI English tutors are stateless. WeakSpot discovers what you need to practice
by analyzing your actual writing and building a persistent DynamoDB weakness profile."

Scene 2 (0:18–0:50) — Diagnose Results
Show: A loading spinner transitions to a diagnostic results panel.
Left column: CEFR badge showing "B1", a circular score ring at 72%.
Right column: Two sections labeled "Strengths" (3 green checkmark items) 
and "Weaknesses" (5 error cards). Each error card has: category tag (e.g., "Verb Tense"),
highlighted original text, explanation, corrected version.
Below: a full "Corrected Reference Text" block with clean fluent English.
Camera: slow vertical scroll through the error cards, brief push-in on one micro-lesson.
Text overlay: "11 error categories → structured diagnosis → DynamoDB write"
Voiceover: "The result is a full diagnostic: CEFR estimate, strengths, weaknesses with micro-lessons,
and a corrected reference text showing exactly how a fluent speaker would say the same thing."

Scene 3 (0:50–1:05) — Notebook & History
Show: Quick cut to a "Notebook" page with saved error cards in a clean grid layout.
Then cut to "History" page: a timeline list of past submissions with dates and error counts.
Text overlay: "Every error saved. Every session logged."
Voiceover: "Errors are saved to the Notebook for review. History logs every past submission permanently."

Scene 4 (1:05–1:22) — Dashboard
Show: Dashboard page. Dominant feature: a radar/spider chart with 11 skill axes,
amber fills on weaker areas. Below: horizontal skill bars (green/amber/red).
Stat cards: "14 Submissions", "89 Errors Tracked", "Estimated Level: B1–B2".
Weakest skills highlighted with a subtle red glow.
Text overlay: "Persistent weakness profile in DynamoDB"
Voiceover: "The dashboard is the proof of persistence. Every diagnosis updates skill records in DynamoDB
across 11 categories — the learner can see exactly what needs practice next."

Scene 5 (1:22–1:42) — 7-Day Plan
Show: Plan page. A "Generate My Plan" button is clicked. 
Cards appear for each day: Day 1 targets "Verb Tense", Day 2 "Article Usage", etc.
Each card shows skill category, difficulty level, and a brief description.
Weakest skill cards appear first with a subtle highlight.
Text overlay: "Weaknesses first. Personalized. Updates as you improve."
Voiceover: "One click generates a personalized 7-Day Study Plan, weakest skills first,
pulled from the DynamoDB weakness profile."

Scene 6 (1:42–2:00) — Practice
Show: Practice page. An exercise prompt appears: fill-in-the-blank sentence targeting Verb Tense.
Learner types an answer. Submit button clicked. 
Grade feedback panel slides in: checkmark, explanation, skill mastery bar ticks up by 3%.
Text overlay: "Grade → update mastery → write to DynamoDB"
Voiceover: "Practice targets the weakest skills. The AI grades each answer
and updates mastery scores in DynamoDB in real time."

Scene 7 (2:00–2:25) — Chat (Text + Speaking)
Show (text mode): Chat interface, learner typing messages, AI responding.
After "End Session" is clicked, an analysis panel animates in: "5 errors found → written to weakness library."
Show (speaking mode): Microphone button active, waveform visible.
A pause/hesitation moment: the learner stops mid-sentence.
A word suggestion panel pops up: 3 candidate phrases like "in addition", "furthermore", "on the other hand".
Text overlay: "Function calling → real-time word prediction"
Voiceover: "In text mode, every chat session is analyzed and errors written to the weakness library.
In speaking mode, when a learner hesitates, function calling predicts their intended words
and surfaces vocabulary scaffolds in real time."

Scene 8 (2:25–2:38) — DynamoDB Proof
Show: AWS Console-style dark UI. Table named "WeakSpotEnglishCoach".
Items with columns PK and SK highlighted.
Rows animate in showing:
USER#abc123 | PROFILE
USER#abc123 | SKILL#VERB_TENSE
USER#abc123 | SUBMISSION#2026-06-29T...
USER#abc123 | PLAN#ACTIVE
Text overlay: "One table. One partition per learner. Single-table DynamoDB design."
Voiceover: "One DynamoDB table. Sort keys encode every entity type.
All of a learner's data in one contiguous partition. Serverless, pay-per-request."

Scene 9 (2:38–2:50) — Closing
Show: Clean dark screen. Animated loop diagram:
Diagnose → Profile → Plan → Practice → Grade → Update → (back to Diagnose)
Then fade to product name and URL.
Final frame:
  WeakSpot English Coach
  englearning.jinxxx.de
  Built with Vercel v0 + Amazon DynamoDB
  #H0Hackathon
Voiceover: "Diagnose. Profile. Plan. Practice. Grade. Update.
WeakSpot English Coach — built with Vercel v0, FastAPI, DeepSeek, and Amazon DynamoDB."
```

---

## MATERIAL GAP ANALYSIS

### What you already have ✅
| File | Covers |
|------|--------|
| `Diagonse->notebook->history->dashboard->practice->plan.mov` | Scenes 2, 3, 4, 5, 6 |
| `Chat.mov` | Scene 7 (text chat portion) |
| `7Day-plan.png` | Scene 5 backup |
| `Import AI history to generate personal weaknesses.png` | Scene 7 transition card |

### What you MUST still record ❌

1. **Speaking mode + word prediction panel** — your most innovative feature, not in any existing recording.
   - Record: open Chat → switch to Speaking mode → start speaking → pause mid-sentence → show word suggestion panel appearing.
   - Duration needed: ~20 seconds

2. **DynamoDB AWS Console** — judges need to see the actual table.
   - Record: open AWS Console → WeakSpotEnglishCoach table → Items view → filter one user's PK → show the SK patterns (PROFILE, SKILL#, SUBMISSION#, etc.)
   - Duration needed: ~15 seconds of scrolling through items

### What you SHOULD verify is clearly visible in existing recordings
- Diagnose results **Strengths section** (green checkmarks) — confirm it's clearly shown in the main flow video
- **Corrected reference text** block at the bottom of results — confirm it scrolls into view
- **Post-chat analysis panel** (the "X errors found → written to weakness library" message) — confirm Chat.mov shows this after ending a session
- Practice **grade feedback** showing skill mastery update — confirm it's in the main flow video

### Recommended re-record (optional but impactful)
- A second Diagnose run with a clearly imperfect paragraph so the error cards are dense and visually striking.
  Use something like: "Yesterday I go to the store but I don't find the thing I was looking for. 
  It were very frustrated experience and I think I will not go back there again."
