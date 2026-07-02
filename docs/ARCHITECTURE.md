# WeakSpot English Coach — Architecture

## Submission-ready architecture diagram

```
                     ┌────────────────────────────────────────────────────┐
                     │                 Vercel (HTTPS / CDN)               │
                     │    Next.js 16 App Router · TypeScript               │
                     │    Tailwind CSS · shadcn/ui · Recharts              │
                     │    Generated with v0.dev — englearning.jinxxx.de   │
                     │                                                      │
                     │  GitHub OAuth ──► session cookie                    │
                     │  Google OAuth ──► session cookie                    │
                     └───────────────────────┬────────────────────────────┘
                                             │
                        ┌────────────────────┼──────────────────────────┐
                        │  HTTPS + CORS      │   WebRTC (audio +        │
                        │  (all API calls)   │   data channel)          │
                        │                    │   [voice sessions only]  │
                        ▼                    ▼                          │
┌──────────────────────────────────┐   ┌──────────────────────────┐    │
│  Linux Server (oracle-us-west)   │   │  OpenAI Realtime API     │    │
│                                  │   │  gpt-realtime-2 / mini   │    │
│  Nginx (Certbot) ─► FastAPI      │   │                          │    │
│  enapi.jinxxx.de   Docker/ARM64  │   │  • Audio I/O (voice)     │    │
│                                  │   │  • Function calling:     │    │
│  Routes:                         │   │    suggest_completion    │    │
│  /diagnose  /profile  /plan      │   │    (word prediction)     │    │
│  /practice  /history  /stats     │   │  • Transcript streaming  │    │
│  /chat      /realtime/session    │   └──────────────┬───────────┘    │
│                                  │                  │                  │
│  Service Layer:                  │    WebSocket     │ sideband         │
│  diagnose · profile · plan       │◄─────────────────┘ (transcript     │
│  practice · chat_service         │    (FastAPI monitors session,       │
│  realtime_sideband               │     saves turns to DynamoDB)        │
│                                  │                                     │
│  ┌─────────────┐ ┌────────────┐  │                                     │
│  │ DeepSeek-V4 │ │ DynamoDB  │  │                                     │
│  │ JSON mode   │ │ boto3 repo│  │                                     │
│  └──────┬──────┘ └─────┬─────┘  │                                     │
└─────────┼──────────────┼────────┘                                     │
          │              │                                               │
          ▼              ▼                                               │
 ┌────────────────┐  ┌───────────────────────────────────────────────┐  │
 │  DeepSeek API  │  │   AWS DynamoDB — WeakSpotEnglishCoach         │  │
 │  V4-Pro        │  │   Single-table design                         │  │
 │  V4-Flash      │  │                                               │  │
 └────────────────┘  │   PK: USER#{id}   SK                         │  │
                      │   ─────────────────────────────────────────  │  │
                      │   USER#{id}       PROFILE                    │  │
                      │   USER#{id}       SKILL#{code}               │  │
                      │   USER#{id}       SUBMISSION#{ts}#{id}       │  │
                      │   USER#{id}       ERROR#{ts}#{id}            │  │
                      │   USER#{id}       PLAN#ACTIVE                │  │
                      │   USER#{id}       EXERCISE#{id}              │  │
                      │   USER#{id}       ATTEMPT#{ts}#{id}          │  │
                      │   USER#{id}       NOTE#{ts}#{id}             │  │
                      │   USER#{id}       SUBHASH#{hash}  (dedup)    │  │
                      │   USER#{id}       CHAT_SESSION#{id}          │  │
                      │   USER#{id}       CHAT_MSG#{ts}#{id}         │  │
                      └───────────────────────────────────────────────┘  │
                                                                         │
                      ◄──────────────────────────────────────────────────┘
                      Browser WebRTC connection goes DIRECTLY to OpenAI
                      (voice audio never passes through FastAPI backend)
```

## The Adaptive Loop (core innovation)

```
Learner writes English
  → DeepSeek diagnoses structured errors (11-category taxonomy)
    → errors + skill mastery written to DynamoDB (the learner profile)
      → plan & practice generated FROM that profile (weakest skills first)
        → practice graded → mastery updated → loop tightens
```

## Data Flow

```
1. POST /diagnose    {userId, text}
   → AI analyzes text for 11 error categories
   → Writes submission + error records + skill updates to DynamoDB
   → Returns diagnostic report with CEFR estimate + structured errors

2. GET /profile/{userId}
   → Reads all skill states + recent errors from DynamoDB
   → Returns weakness radar data (mastery %, error counts per skill)

3. POST /plan         {userId}
   → Reads learner's weakest skills from DynamoDB
   → AI generates 7-day plan targeting those specific weaknesses
   → Writes plan to DynamoDB

4. POST /practice/generate {userId, targetSkillCode?}
   → AI generates exercise targeting the learner's weakest skill
   → Returns exercise card (Chinese instruction + English question)

5. POST /practice/submit {userId, exerciseId, userAnswer}
   → AI grades the answer
   → Updates skill mastery in DynamoDB (delta)
   → Returns grade + feedback + corrected answer

6. GET /stats/daily/{userId}
   → Aggregates from DynamoDB records (submissions, attempts, errors)
   → Returns 7-day streak, focus minutes, badges, next best action

7. POST /chat/realtime/session  {userId, topic, model}   [Voice Chat]
   → FastAPI creates ephemeral OpenAI Realtime session (returns clientSecret)
   → Browser opens WebRTC connection DIRECTLY to OpenAI using that secret
   → Browser opens data channel for function call events (suggest_completion)
   → FastAPI opens WebSocket sideband to same session → saves transcripts to DynamoDB
   → On session end: transcript analyzed → errors written to SKILL# records

8. POST /chat/sessions + POST /chat/sessions/{id}/messages   [Text Chat]
   → Creates chat session in DynamoDB
   → Each user message → DeepSeek generates reply → both saved to DynamoDB
   → POST /chat/sessions/{id}/analyze: AI analyzes all user messages in session
   → Extracts errors → writes to ERROR# + updates SKILL# mastery
```

## Tech Stack Summary

| Layer    | Technology |
|----------|------------|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Frontend Gen | **Vercel v0** (hackathon requirement) |
| Frontend Deploy | **Vercel** (HTTPS, CDN) |
| Backend | **FastAPI** (Python 3.11), Docker on Linux (ARM64) |
| Reverse Proxy | Nginx + Certbot (HTTPS) |
| AI (text) | **DeepSeek-V4-Pro** + V4-Flash (OpenAI-compatible API, JSON mode + Pydantic) |
| AI (voice) | **OpenAI Realtime API** — WebRTC, `gpt-realtime-2` / mini, function calling |
| Database | **Amazon DynamoDB** — single-table design (`WeakSpotEnglishCoach`) |
| Auth | GitHub OAuth + Google OAuth (session cookie) |
