# Gemini / Veo Demo Video Prompt - WeakSpot English Coach

Use this prompt in **Google Gemini / Veo video generation** to create a fast, screen-recording-style hackathon demo for https://englearning.jinxxx.de.

**Hard limit:** 2:30 target runtime, never exceed 3:00.  
**Format:** 16:9 landscape, crisp browser capture, clear English voiceover, minimal on-screen text.  
**Audience:** H0: Hack the Zero Stack judges evaluating Vercel v0 + AWS Databases.  
**Core proof:** Amazon DynamoDB single-table design powers the learner profile. This is not a stateless chatbot.

## Opening Hook

Start with this judge-facing hook in the first 5 seconds:

**On-screen text:** "Judges: this is a DynamoDB-powered learning loop, not a chatbot demo."  
**Voiceover:** "In two minutes, I'll show how WeakSpot turns one English paragraph into a persistent DynamoDB weakness profile, a study plan, and targeted practice."

## Veo Direction

- Style: polished product demo, realistic browser screen recording, smooth visible cursor.
- Camera: mostly locked screen capture; use quick digital push-ins only to highlight important UI or DynamoDB keys.
- Transitions: hard cuts or quick match cuts only. No long fades, no abstract animations, no stock footage.
- Text overlays: short labels only, such as "DynamoDB write", "Single table", "Weakest skill first".
- Pacing: keep every shot purposeful; skip login, empty states, and setup.
- AWS Console: use a pre-captured screenshot or recording of the `WeakSpotEnglishCoach` table to avoid login friction.

## Scene-by-Scene Script

### Scene 1 - Judge Hook + Diagnose (0:00-0:30)

**Shot type:** Wide browser screen capture of the home page at `englearning.jinxxx.de`.  
**Camera motion:** Locked frame, then a subtle digital push-in on the textarea and "Analyze My English" button.  
**Transition in:** Cold open, no intro animation.  
**Visual action:** Show the sample paragraph already filled in. Click "Analyze My English". Show loading state, then diagnostic results with CEFR level, score, and error cards.  
**Overlay:** "Input -> AI diagnosis -> DynamoDB write"

**Voiceover:**  
"Judges: this is a DynamoDB-powered learning loop, not a chatbot demo. WeakSpot starts with a learner's real writing. DeepSeek analyzes it against 11 error categories, returns a CEFR estimate and micro-lessons, and the backend immediately writes the result into DynamoDB."

### Scene 2 - Diagnostic Value (0:30-0:55)

**Shot type:** Medium close screen capture of the results panel.  
**Camera motion:** Slow vertical pan across error cards; brief push-in on one micro-lesson.  
**Transition:** Hard cut from loading/results.  
**Visual action:** Highlight error categories such as verb tense, articles, prepositions, clarity, and word choice. Show score ring or CEFR badge.  
**Overlay:** "Structured errors become learner data"

**Voiceover:**  
"The diagnosis is structured, not just advice. Each error is tagged to a skill, so the app can update mastery over time instead of forgetting the learner after each prompt."

### Scene 3 - Dashboard: DynamoDB Profile (0:55-1:20)

**Shot type:** Wide browser capture of `/dashboard`.  
**Camera motion:** Smooth cursor movement across radar chart, skill bars, and stat cards; quick push-in on weakest skills.  
**Transition:** Match cut from error category to the same skill on the dashboard.  
**Visual action:** Show radar chart, red/amber/green skill bars, estimated level, submission count, and practice attempts.  
**Overlay:** "Persistent weakness profile in DynamoDB"

**Voiceover:**  
"The dashboard is the proof of persistence. Every diagnosis updates skill records in DynamoDB, creating an evolving weakness profile across 11 categories. The learner can see exactly what needs practice next."

### Scene 4 - Single-Table Design Proof (1:20-1:55)

**Shot type:** AWS Console screenshot or screen recording of the DynamoDB table items.  
**Camera motion:** Digital push-in on table name, then on `PK` and `SK` columns; hold long enough to read the key patterns.  
**Transition:** Hard cut from dashboard skill bar to matching `SKILL#` item in DynamoDB.  
**Visual action:** Show `WeakSpotEnglishCoach` table. Highlight one user's contiguous partition:

```txt
PK = USER#{userId}
SK = PROFILE
SK = SKILL#{skillCode}
SK = SUBMISSION#{createdAt}#{submissionId}
SK = ERROR#{createdAt}#{errorId}
SK = PLAN#ACTIVE
SK = EXERCISE#{exerciseId}
SK = ATTEMPT#{createdAt}#{attemptId}
SK = SUBHASH#{textHash}
```

**Overlay:** "One table. One learner partition. Many entity types."

**Voiceover:**  
"Here is the AWS database architecture: one DynamoDB table named WeakSpotEnglishCoach. The partition key is `USER` plus the learner id. Sort keys encode entity types: profile, skills, submissions, errors, plans, exercises, attempts, and dedup hashes. A single query can read the learner's profile data from one contiguous partition. This is DynamoDB single-table design built around the app's access patterns."

### Scene 5 - Plan + Practice Loop (1:55-2:20)

**Shot type:** Browser capture moving from `/plan` to `/practice`.  
**Camera motion:** Quick pan between plan cards; push-in on a weakest-skill practice card.  
**Transition:** Match cut from `PLAN#ACTIVE` in DynamoDB to the generated plan page.  
**Visual action:** Click "Generate 7-Day Plan", show weakest-skills-first plan, open practice, answer one exercise, show grade and feedback.  
**Overlay:** "Read profile -> generate plan -> grade attempt -> update skill"

**Voiceover:**  
"The plan is generated from the DynamoDB weakness profile, weakest skills first. Practice targets those skills, the AI grades the answer, and the backend writes the attempt plus a mastery update back to the same table."

### Scene 6 - Closing Loop (2:20-2:30)

**Shot type:** Clean full-screen app view with a simple loop overlay.  
**Camera motion:** Locked frame.  
**Transition:** Hard cut from practice feedback to final screen.  
**Visual action:** Show loop: Diagnose -> Profile -> Plan -> Practice -> Grade -> Update. End on product name and URL.  
**Overlay / final screen:**

```txt
WeakSpot English Coach
https://englearning.jinxxx.de
H0: Hack the Zero Stack
Vercel v0 + Amazon DynamoDB single-table design
```

**Voiceover:**  
"WeakSpot English Coach closes the loop: diagnose, profile, plan, practice, grade, update. Built with Vercel v0, FastAPI, DeepSeek, and Amazon DynamoDB single-table design."

## Capture Checklist

- Home: `https://englearning.jinxxx.de`
- Dashboard: `https://englearning.jinxxx.de/dashboard`
- Plan: `https://englearning.jinxxx.de/plan`
- Practice: `https://englearning.jinxxx.de/practice`
- AWS Console: `WeakSpotEnglishCoach` items with readable `PK` and `SK`
- Use a populated demo account with at least 5 submissions so charts and plans are not empty.
- Keep narration direct and under roughly 340 words.
