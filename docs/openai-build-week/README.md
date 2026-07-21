# OpenAI Build Week Demo Production Pack

Target: a public English demo video at **2:50–2:58**, never over 3:00.

Current production status: **final MP4 generated and verified**. The exact
174-second narration, sentence-aligned English/Chinese subtitles, fixed-viewport
production captures, and evidence cards are assembled into
`output/weakspot-openai-build-week-final.mp4`. The app footage was captured only
after PR #70 reached Vercel Production and real missions visibly returned
`gpt-5.6-sol · Responses API` with all four planner-insight sections.

The previous Qwen video is not submission-ready for OpenAI Build Week. Product
footage can be reused, but remove the Qwen Cloud marketplace/console sequence,
Alibaba-as-a-requirement language, Qwen-only architecture, and narration that
does not explain Codex or GPT-5.6.

## Files

- `script-en.md` — exact English narration, written to fit under three minutes.
- `subtitles-zh-review.md` — sentence-matched Chinese translation for review.
- `shot-list.md` — screen actions aligned to the narration.
- `voiceover-en.txt` — the exact 20-sentence TTS input.
- `generate-narration.sh` — generates sentence-level Qwen Audio narration,
  real English SRT timing, and the aligned reviewed Chinese SRT.
- `build-evidence-cards.sh` — renders clearly labeled architecture, code, test,
  health, and end cards without secrets.
- `build-final-video.sh` — maps each narration sentence to a stable product
  capture/evidence card and exports the bilingual-captioned MP4.
- `qa-final-video.sh` — validates duration and cue counts, detects long silence,
  and extracts one midpoint frame per narration sentence for visual review.

## Capture prerequisites

The final sequence was recorded only after these were true:

1. The final commit is deployed.
2. The backend has `OPENAI_BUILD_WEEK_ENABLED=true` and a server-side key.
3. Public health reports `enabled: true`, `configured: true`,
   `model: gpt-5.6-sol`, `api: responses`.
4. A newly generated Coach mission visibly shows `gpt-5.6-sol · Responses API`
   and all four planner-insight sections.
5. Backend logs show `openai_mission ... upstream_ok` for that request without
   exposing the key or raw learner text.

The only remaining submission-time item is the main Codex session's `/feedback`
Session ID; it does not alter the already captured runtime proof.

## Audio/subtitle workflow

Generate narration sentence by sentence. Record the exact duration of each
audio sentence, then derive English and Chinese SRT timecodes from those real
durations. Do not manually stretch one subtitle timeline over a different voice
track. Leave 80–140 ms of silence between sentences and cut visuals at sentence
boundaries wherever possible.

The earlier Qwen TTS can be replaced with any natural, licensed voice. The
competition requirement is audible explanation, not a particular TTS provider.
If Qwen Audio is retained for narration, describe it only as video-production
audio; do not imply it is the Build Week runtime model.

After reviewing the Chinese text, generate the aligned audio and subtitles:

```bash
cd docs/openai-build-week
bash generate-narration.sh --dry-run
bash generate-narration.sh
```

This reuses the private `docs/demo-production/.env` and its previously validated
single-narrator voice configuration; adding a new per-request instruction made
the current Qwen endpoint return an empty audio response, so the working voice
configuration is intentionally kept unchanged. The command does not print the
key. Expected outputs are
`output/voiceover-qwen-mastered.m4a`, `output/subtitles-qwen.srt`,
`output/subtitles-zh.srt`, and `output/timeline-qwen.json`.

Build and verify the final video:

```bash
bash docs/openai-build-week/build-evidence-cards.sh
bash docs/openai-build-week/build-final-video.sh
bash docs/openai-build-week/qa-final-video.sh
```

Verified result: 174.033 seconds, 1920×1080, constant 30 fps, H.264 video,
48 kHz mono AAC narration, default Simplified Chinese captions, selectable
English captions, 20 sentence-aligned visual segments, and no detected silence
longer than 0.8 seconds. The old demo audio—including its 17–19 second voice
intrusion—is not used anywhere in this build.

## Stabilizing the picture

- Record the browser at a fixed 1920×1080 viewport and 100% zoom.
- Disable smooth scrolling and cursor acceleration effects.
- Use hard cuts or short 6–10 frame dissolves; do not apply repeated digital
  zooms, pan-and-scan, or stabilization to already stable screen recordings.
- Capture each interaction as its own clip with 0.5–1.0 seconds of stillness at
  the beginning and end.
- Crop once per source clip, not once per frame.
- Keep the cursor still while narration explains a completed state.

## Final export checks

- Duration is at most 180.0 seconds.
- 1920×1080, constant 30 fps, H.264 video, AAC audio.
- No API keys, cookies, emails, account IDs, console secrets, or private learner
  content are visible.
- Audio explicitly covers what was built, how Codex was used, and how GPT-5.6
  is used.
- Captions match the final narration sentence for sentence.
- The YouTube link is public or unlisted and playable while logged out.
