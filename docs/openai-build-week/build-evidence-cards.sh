#!/usr/bin/env bash
set -euo pipefail

production_dir="$(cd "$(dirname "$0")" && pwd)"
cards_dir="$production_dir/output/cards"
font_regular="/System/Library/Fonts/Supplemental/Arial.ttf"
font_bold="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
font_mono="/System/Library/Fonts/Menlo.ttc"

mkdir -p "$cards_dir"

magick -size 1920x1080 xc:'#0b1220' \
  -fill '#63e6be' -font "$font_bold" -pointsize 28 -annotate +130+110 'OPENAI BUILD WEEK · EDUCATION' \
  -fill '#f8fafc' -pointsize 78 -annotate +130+235 'GPT-5.6 Adaptive' \
  -annotate +130+330 'Mission Planner' \
  -fill '#cbd5e1' -font "$font_regular" -pointsize 34 \
  -annotate +135+435 'A meaningful extension to WeakSpot English Coach' \
  -fill '#122033' -stroke '#2dd4bf' -strokewidth 2 \
  -draw 'roundrectangle 130,530 1790,820 28,28' \
  -stroke none -fill '#f8fafc' -font "$font_bold" -pointsize 34 \
  -annotate +185+610 'Codex' -annotate +185+705 'GPT-5.6 Sol' -annotate +185+800 'Evidence trail' \
  -fill '#94a3b8' -font "$font_regular" -pointsize 30 \
  -annotate +520+610 'development collaborator' \
  -annotate +520+705 'runtime model · OpenAI Responses API' \
  -annotate +520+800 'why now · evidence · adaptation · evaluation' \
  -fill '#64748b' -pointsize 24 -annotate +135+980 'Merged PR #70 · production commit ffd994e · englearning.jinxxx.de' \
  "$cards_dir/03-build-week-title.png"

magick -size 1920x1080 xc:'#f7f2e9' \
  -fill '#9a5b2f' -font "$font_bold" -pointsize 28 -annotate +120+95 'DETERMINISTIC FIRST · GENERATIVE SECOND' \
  -fill '#1f2937' -pointsize 62 -annotate +120+185 'The scheduler chooses what matters now' \
  -fill '#667085' -font "$font_regular" -pointsize 29 \
  -annotate +122+245 'GPT-5.6 receives the bounded decision context — not the learner’s full history.' \
  -fill '#fffdf8' -stroke '#d8cfc0' -strokewidth 2 \
  -draw 'roundrectangle 120,330 430,520 24,24' \
  -draw 'roundrectangle 465,330 775,520 24,24' \
  -draw 'roundrectangle 810,330 1120,520 24,24' \
  -draw 'roundrectangle 1155,330 1465,520 24,24' \
  -draw 'roundrectangle 1500,330 1800,520 24,24' \
  -stroke none -fill '#9a5b2f' -font "$font_bold" -pointsize 30 \
  -annotate +175+405 'WEAK' -annotate +500+405 'UNCERTAIN' -annotate +850+405 'OVERDUE' \
  -annotate +1205+405 'RELEVANT' -annotate +1535+405 'REPEATED' \
  -fill '#667085' -font "$font_regular" -pointsize 24 \
  -annotate +175+458 'mastery gap' -annotate +515+458 'information gain' -annotate +852+458 'spacing' \
  -annotate +1210+458 'current goal' -annotate +1540+458 'fatigue guard' \
  -fill '#173f3b' -stroke '#4fb6a8' -strokewidth 2 \
  -draw 'roundrectangle 270,650 1650,900 30,30' \
  -stroke none -fill '#d9fbf4' -font "$font_bold" -pointsize 34 \
  -annotate +335+730 'SELECTED TARGET' \
  -fill '#ffffff' -pointsize 48 -annotate +335+810 'verb tense + articles + prepositions' \
  -fill '#9adbd0' -font "$font_regular" -pointsize 26 \
  -annotate +335+865 'time · modality · energy · task format · evidence summary' \
  "$cards_dir/05-scheduler.png"

magick -size 1920x1080 xc:'#0b1220' \
  -fill '#63e6be' -font "$font_bold" -pointsize 28 -annotate +110+85 'NATIVE STRUCTURED OUTPUTS' \
  -fill '#f8fafc' -pointsize 56 -annotate +110+165 'One typed contract for the task and its evidence' \
  -fill '#111b2b' -stroke '#334155' -strokewidth 2 \
  -draw 'roundrectangle 105,245 925,930 24,24' \
  -draw 'roundrectangle 995,245 1815,930 24,24' \
  -stroke none -fill '#94a3b8' -font "$font_bold" -pointsize 25 \
  -annotate +155+305 'PYDANTIC SCHEMA' -annotate +1045+305 'RESPONSES API' \
  -fill '#e2e8f0' -font "$font_mono" -pointsize 25 \
  -annotate +155+375 $'class CoachPlannerInsight(BaseModel):\n    whyNow: str\n    evidenceUsed: list[str]\n    adaptation: str\n    evaluationFocus: list[str]\n\nclass GPT56CoachMissionAIResult:\n    mission: CoachMissionAI\n    plannerInsight: CoachPlannerInsight' \
  -annotate +1045+375 $'client.responses.parse(\n    model="gpt-5.6-sol",\n    input=messages,\n    text_format=response_model,\n    reasoning={"effort": "medium"},\n    safety_identifier=hashed_user_id,\n    store=False,\n)' \
  -fill '#64748b' -font "$font_regular" -pointsize 23 \
  -annotate +110+1010 'Source: apps/api/app/models/coach.py + services/openai_mission_service.py' \
  "$cards_dir/09-structured-output.png"

magick -size 1920x1080 xc:'#f7f2e9' \
  -fill '#9a5b2f' -font "$font_bold" -pointsize 28 -annotate +120+95 'LEARNING LOOP' \
  -fill '#1f2937' -pointsize 62 -annotate +120+185 'Every attempt becomes decision evidence' \
  -fill '#fffdf8' -stroke '#d8cfc0' -strokewidth 2 \
  -draw 'roundrectangle 120,335 520,805 28,28' \
  -draw 'roundrectangle 760,335 1160,805 28,28' \
  -draw 'roundrectangle 1400,335 1800,805 28,28' \
  -stroke none -fill '#1f2937' -font "$font_bold" -pointsize 38 \
  -annotate +205+415 'ATTEMPT' -annotate +835+415 'EVIDENCE' -annotate +1460+415 'NEXT TASK' \
  -fill '#667085' -font "$font_regular" -pointsize 28 \
  -annotate +175+500 $'typed or spoken\nindependent or assisted\nsuccess, failure, avoidance' \
  -annotate +815+500 $'skill + modality\ntask type + hint level\ntransfer now and later' \
  -annotate +1450+500 $'due + uncertain\nproductive difficulty\nnovel but relevant' \
  -fill '#4fb6a8' -font "$font_bold" -pointsize 70 \
  -annotate +610+600 '→' -annotate +1250+600 '→' \
  -fill '#173f3b' -stroke '#4fb6a8' -strokewidth 2 \
  -draw 'roundrectangle 330,880 1590,985 24,24' \
  -stroke none -fill '#d9fbf4' -font "$font_bold" -pointsize 30 \
  -annotate +440+945 'Cross-session memory changes what the coach does next' \
  "$cards_dir/13-evidence-loop.png"

magick -size 1920x1080 xc:'#0b1220' \
  -fill '#63e6be' -font "$font_bold" -pointsize 28 -annotate +110+85 'CODEX COLLABORATION · IMPLEMENTATION' \
  -fill '#f8fafc' -pointsize 56 -annotate +110+165 'Auditable OpenAI-only runtime path' \
  -fill '#111b2b' -stroke '#334155' -strokewidth 2 \
  -draw 'roundrectangle 105,250 930,935 24,24' \
  -draw 'roundrectangle 990,250 1815,935 24,24' \
  -stroke none -fill '#94a3b8' -font "$font_bold" -pointsize 24 \
  -annotate +150+310 'BACKEND · RESPONSES ADAPTER' -annotate +1035+310 'FRONTEND · RUNTIME PROOF' \
  -fill '#e2e8f0' -font "$font_mono" -pointsize 23 \
  -annotate +150+380 $'response = OpenAI(...).responses.parse(\n    model=model,\n    input=messages,\n    text_format=response_model,\n    reasoning={"effort": reasoning_effort},\n    safety_identifier=hashed_id,\n    store=False,\n)\n\nmetadata.model = response.model' \
  -annotate +1035+380 $'{mission.generation?.provider === "OpenAI"\n  ? <Badge>\n      {mission.generation.model}\n      · Responses API\n    </Badge>\n  : null}\n\n{mission.plannerInsight && (...) }' \
  -fill '#64748b' -font "$font_regular" -pointsize 22 \
  -annotate +110+1010 'Actual source excerpts · secrets excluded' \
  "$cards_dir/17-code.png"

magick -size 1920x1080 xc:'#0b1220' \
  -fill '#63e6be' -font "$font_bold" -pointsize 28 -annotate +120+95 'VALIDATION · CURRENT REVISION' \
  -fill '#f8fafc' -pointsize 62 -annotate +120+185 'Tests and live evidence agree' \
  -fill '#111b2b' -stroke '#334155' -strokewidth 2 \
  -draw 'roundrectangle 120,280 1800,900 28,28' \
  -stroke none -fill '#d9fbf4' -font "$font_mono" -pointsize 28 \
  -annotate +185+355 $'✓ COACH CONTRACT CHECKS PASSED\n✓ FULL LOOP PASSED\n✓ MEMORYAGENT TESTS PASSED\n✓ MEMORY BENCHMARK PASSED · Recall@6 1.0\n✓ LEARNING LOOP TESTS PASSED\n✓ pnpm lint · TypeScript · Next.js production build\n✓ Vercel Production · ffd994e\n✓ 2 public GPT-5.6 missions · 2 upstream_ok traces' \
  -fill '#94a3b8' -font "$font_regular" -pointsize 25 \
  -annotate +120+990 'PR #70 · 35 files · +1,658 / −189 · backend archive SHA-256 recorded in the build log' \
  "$cards_dir/17-tests.png"

magick -size 1920x1080 xc:'#f7f2e9' \
  -fill '#9a5b2f' -font "$font_bold" -pointsize 28 -annotate +120+95 'RUNTIME ARCHITECTURE' \
  -fill '#1f2937' -pointsize 62 -annotate +120+185 'Bounded context in, typed mission out' \
  -fill '#fffdf8' -stroke '#d8cfc0' -strokewidth 2 \
  -draw 'roundrectangle 90,350 420,680 24,24' \
  -draw 'roundrectangle 555,350 955,680 24,24' \
  -draw 'roundrectangle 1090,350 1485,680 24,24' \
  -draw 'roundrectangle 1620,350 1845,680 24,24' \
  -stroke none -fill '#1f2937' -font "$font_bold" -pointsize 34 \
  -annotate +145+435 'NEXT.JS' -annotate +620+435 'FASTAPI' -annotate +1145+435 'OPENAI' -annotate +1650+435 'UI' \
  -fill '#667085' -font "$font_regular" -pointsize 24 \
  -annotate +130+510 $'time\nmodality\nenergy' \
  -annotate +615+510 $'scheduler\nmemory pack\nmodel guard' \
  -annotate +1145+510 $'Responses API\nGPT-5.6 Sol\nStructured Output' \
  -annotate +1655+510 $'mission\nevidence\nfeedback' \
  -fill '#4fb6a8' -font "$font_bold" -pointsize 64 \
  -annotate +445+545 '→' -annotate +990+545 '→' -annotate +1510+545 '→' \
  -fill '#173f3b' -stroke '#4fb6a8' -strokewidth 2 \
  -draw 'roundrectangle 300,810 1620,940 26,26' \
  -stroke none -fill '#d9fbf4' -font "$font_bold" -pointsize 28 \
  -annotate +390+875 'server-only key · store=false · hashed safety ID · actual response.model' \
  "$cards_dir/18-architecture.png"

magick -size 1920x1080 xc:'#0b1220' \
  -fill '#63e6be' -font "$font_bold" -pointsize 28 -annotate +110+85 'PUBLIC RUNTIME PROOF · 2026-07-20 PDT' \
  -fill '#f8fafc' -pointsize 54 -annotate +110+165 'enapi.jinxxx.de/api/v1/health' \
  -fill '#111b2b' -stroke '#334155' -strokewidth 2 \
  -draw 'roundrectangle 105,245 1815,895 24,24' \
  -stroke none -fill '#e2e8f0' -font "$font_mono" -pointsize 30 \
  -annotate +160+335 $'{\n  "status": "ok",\n  "capabilities": {\n    "openaiBuildWeek": {\n      "enabled": true,\n      "configured": true,\n      "model": "gpt-5.6-sol",\n      "api": "responses",\n      "feature": "adaptive_mission_planner_v1"\n    }\n  }\n}' \
  -fill '#63e6be' -font "$font_bold" -pointsize 28 \
  -annotate +1120+390 $'LIVE PROBES\n\nmission_8af078f6caf7\nmission_55c5ac47c15f\n\n2 distinct OpenAI response IDs\n2 upstream_ok traces' \
  -fill '#64748b' -font "$font_regular" -pointsize 23 \
  -annotate +110+990 'Secret-free response copied from the public endpoint · API key never displayed' \
  "$cards_dir/19-health.png"

magick -size 1920x1080 xc:'#0b1220' \
  -fill '#63e6be' -font "$font_bold" -pointsize 30 -gravity North -annotate +0+150 'WEAKSPOT ENGLISH COACH' \
  -fill '#f8fafc' -pointsize 70 -annotate +0+285 'Right evidence.' \
  -annotate +0+380 'Right challenge.' \
  -annotate +0+475 'Right moment.' \
  -fill '#cbd5e1' -font "$font_regular" -pointsize 34 -annotate +0+610 'GPT-5.6 Adaptive Mission Planner · built with Codex' \
  -fill '#d9fbf4' -font "$font_bold" -pointsize 34 -annotate +0+735 'englearning.jinxxx.de' \
  -fill '#94a3b8' -font "$font_regular" -pointsize 26 -annotate +0+810 'github.com/jinyu-cai/weakspot-english-coach' \
  -fill '#64748b' -pointsize 23 -annotate +0+955 'OpenAI Build Week · Education · MIT License' \
  "$cards_dir/20-end.png"

echo "Created evidence cards in $cards_dir"
