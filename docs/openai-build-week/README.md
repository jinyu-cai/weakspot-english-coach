# OpenAI Build Week Demo Production Pack

Target: a public English demo video at **2:50–2:58**, never over 3:00.

Current production status: the exact 174-second narration and sentence-aligned
English/Chinese subtitles have been generated in the ignored local `output/`
directory. Final browser footage is intentionally pending the real deployed
GPT-5.6 path; no mock screen will be presented as live evidence.

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

## Capture prerequisites

Do not record the final GPT-5.6 sequence until all of these are true:

1. The final commit is deployed.
2. The backend has `OPENAI_BUILD_WEEK_ENABLED=true` and a server-side key.
3. Public health reports `enabled: true`, `configured: true`,
   `model: gpt-5.6-sol`, `api: responses`.
4. A newly generated Coach mission visibly shows `gpt-5.6-sol · Responses API`
   and all four planner-insight sections.
5. Backend logs show `openai_mission ... upstream_ok` for that request without
   exposing the key or raw learner text.
6. The main Codex session has a `/feedback` Session ID.

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
