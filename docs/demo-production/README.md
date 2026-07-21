# WeakSpot Demo Video Production Pack

Target: a public, English-language hackathon demo video at **2:54**.

## Deliverables

- `voiceover-en.txt` — final English narration.
- `subtitles-en.srt` — timed English captions.
- `subtitles-zh-review.md` — revised Chinese narration/subtitle copy for review.
- `subtitles-zh-review.srt` — provisional Chinese review captions; final timing
  is regenerated from the revised sentence-level Qwen audio after approval.
- `align-zh-subtitles.py` — applies the real sentence-level Qwen timings to the
  reviewed Chinese captions and writes `output/subtitles-zh.srt`.
- `shot-list.md` — exact screen actions and recording requirements.
- `generate-qwen-voiceover.sh` — installs the official SDK in an ignored local
  environment and generates the narration with Qwen Audio 3 TTS Plus.
- `generate-qwen-segmented.sh` — generates one Qwen clip per sentence, masters
  them to 2:54, and derives exact subtitles from the real audio durations.
- `build-browser-clips.sh` — turns the captured real product screens into the
  first five pixel-stable demo clips without per-frame zoom jitter.
- `render-final.sh` — combines seven screen recordings, narration, and captions.
- `render-placeholder.sh` — builds a timing preview before real recordings exist.

Generated files are written to `output/`. Raw screen recordings belong in
`clips/` and are intentionally ignored by Git.

## Required clip names

| Clip | Target duration | Content |
| --- | ---: | --- |
| `01-hook.mp4` | 14.3s | Memory Center and durable learner context |
| `02-accumulation.mp4` | 18.3s | Generic communication goal diagnosis and created memories |
| `03-recall.mp4` | 58.1s | Natural chat, five Coach formats, picture story, listen-and-retell, dynamic scene |
| `04-forgetting.mp4` | 25.4s | Bounded recall, lifecycle, and learner control |
| `05-decision.mp4` | 21.6s | Outcome-driven recommendation and task choice |
| `06-architecture.mp4` | 18.2s | Alibaba architecture and actual Qwen model screens |
| `07-close.mp4` | 18.1s | Benchmark and product close |

The renderer trims long clips and holds the last frame of short clips. Record a
few seconds longer than each target when practical.

## Commands

Configure Qwen Cloud TTS without sharing the API key in chat:

```bash
cp docs/demo-production/.env.example docs/demo-production/.env
chmod 600 docs/demo-production/.env
```

Open `docs/demo-production/.env` in a local editor and replace the secret
placeholder. The repository ignores `.env*` files. The default system voice is
`longanlingxin`, a warm English-capable Qwen Audio 3 Plus voice.

Generate and validate the Qwen narration:

```bash
bash docs/demo-production/generate-qwen-voiceover.sh --dry-run
bash docs/demo-production/generate-qwen-voiceover.sh
bash docs/demo-production/master-qwen-voiceover.sh
```

For the final synchronized version, use the sentence-aligned generator instead:

```bash
bash docs/demo-production/generate-qwen-segmented.sh --dry-run
bash docs/demo-production/generate-qwen-segmented.sh
```

It creates `output/voiceover-qwen-mastered.m4a`,
`output/subtitles-qwen.srt`, and `output/timeline-qwen.json`. The renderer
automatically prefers the aligned subtitle file and uses the same timeline for
scene boundaries, so narration, captions, and visuals change together.

Align the approved Chinese captions to those exact sentence timings:

```bash
python3 docs/demo-production/align-zh-subtitles.py
```

The raw result is `output/voiceover-qwen.mp3`. The mastering command makes an
exact 2:54 file at `output/voiceover-qwen-mastered.m4a`, normalizes it for video,
and preserves the entire narration. Both renderers prefer this mastered Qwen
file and fall back to the local macOS timing voice only when it is unavailable.

Create a timing preview with placeholder cards:

```bash
bash docs/demo-production/render-placeholder.sh
```

When the generated scene 6 and 7 clips exist, the timing preview includes them
automatically and uses placeholder cards only for the still-unrecorded scenes.

After browser captures have been saved under `output/browser-captures/`, build
the real-screen clips for scenes 1–5:

```bash
bash docs/demo-production/build-browser-clips.sh
```

After recording the seven clips:

```bash
bash docs/demo-production/render-final.sh
```

The final output is `docs/demo-production/output/weakspot-demo-final.mp4`.
The MP4 contains default Simplified Chinese captions and a selectable English
caption track. Upload `output/subtitles-zh.srt` and `output/subtitles-qwen.srt`
separately when the publishing platform supports external caption files.

Scenes 6 and 7 can be built immediately from the checked-in architecture and
the freshly verified benchmark result:

```bash
bash docs/demo-production/build-evidence-clips.sh
```

These source-backed clips are suitable as a clean baseline. Replace their ECS,
health, Qwen model, DynamoDB, or GitHub cards with live console recordings when
those recordings make the same evidence easier for judges to verify.

## Safety

Use a test learner account. Never record API keys, cookies, OAuth values, AWS
credentials, owner tokens, private learner content, or a terminal command that
would print environment variables. Confirm the public application is actually
routed to Alibaba Cloud ECS during capture.
