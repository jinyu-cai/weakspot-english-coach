#!/usr/bin/env bash
set -euo pipefail

production_dir="$(cd "$(dirname "$0")" && pwd)"
captures_dir="$production_dir/output/browser-captures"
clips_dir="$production_dir/clips"
public_recall="$captures_dir/04-recall-traces-public.png"
font="/System/Library/Fonts/Supplemental/Arial.ttf"

mkdir -p "$clips_dir"

if [[ ! -f "$captures_dir/04-recall-traces.png" ]]; then
  echo "Missing browser capture: $captures_dir/04-recall-traces.png" >&2
  exit 1
fi

# Keep the real recall UI and token count while hiding private learner memories
# before producing a video intended for public hackathon submission.
magick "$captures_dir/04-recall-traces.png" \
  -fill '#fffdf9' -stroke '#e4ddd3' -strokewidth 2 \
  -draw 'roundrectangle 946,372 1492,770 18,18' \
  -font "$font" -fill '#5f574f' -stroke none -pointsize 24 \
  -gravity NorthWest -annotate +1040+470 'Memory details hidden\nfor public demo' \
  "$public_recall"

outputs=(
  "$clips_dir/01-hook.mp4"
  "$clips_dir/02-accumulation.mp4"
  "$clips_dir/03-recall.mp4"
  "$clips_dir/04-forgetting.mp4"
  "$clips_dir/05-decision.mp4"
)
durations=(16 32 28 23 28)

timeline="$production_dir/output/timeline-qwen.json"
if [[ ! -f "$timeline" ]] || ! command -v jq >/dev/null 2>&1; then
  echo "Exact visual timing requires $timeline and jq" >&2
  exit 1
fi

durations=()
while IFS= read -r duration; do
  durations+=("$duration")
done < <(jq -r '.scenes[0:5][].duration' "$timeline")

segment_span() {
  local first="$1"
  local last="$2"
  jq -r --argjson first "$first" --argjson last "$last" \
    '.segments[$last - 1].end - .segments[$first - 1].start' "$timeline"
}

scene_images=(
  "$captures_dir/01-memory-center.png"
  "$captures_dir/15-memory-general-goal.png"
  "$captures_dir/14-diagnosis-general.png"
  "$captures_dir/13-natural-weakness-chat.png"
  "$captures_dir/08-coach-formats.png"
  "$captures_dir/09-picture-story.png"
  "$captures_dir/10-listen-retell.png"
  "$captures_dir/11-chat-home-qwen.png"
  "$captures_dir/12-dynamic-chat.png"
  "$public_recall"
  "$captures_dir/05-archived-memories.png"
  "$captures_dir/03-memory-cards.png"
  "$captures_dir/07-personalized-mission.png"
  "$captures_dir/06-todays-mission.png"
)

for image in "${scene_images[@]}"; do
  if [[ ! -f "$image" ]]; then
    echo "Missing browser capture: $image" >&2
    exit 1
  fi
done

render_scene() {
  local output="$1"
  local duration="$2"
  shift 2
  if (( $# == 0 || $# % 2 != 0 )); then
    echo "render_scene expects image/duration pairs" >&2
    exit 1
  fi
  local count="$(( $# / 2 ))"
  local frames
  local filter=""
  local concat_inputs=""
  local image
  local clip_duration
  local index=0
  local total_duration=0
  local ffmpeg_inputs=()

  frames="$(awk -v seconds="$duration" 'BEGIN { printf "%d", (seconds * 30) + 0.999 }')"

  while (( $# )); do
    image="$1"
    clip_duration="$2"
    shift 2
    total_duration="$(awk -v total="$total_duration" -v part="$clip_duration" 'BEGIN { printf "%.9f", total + part }')"
    ffmpeg_inputs+=( -loop 1 -t "$clip_duration" -i "$image" )
    # Keep every capture pixel-stable. Hard cuts make the real UI changes
    # readable without reintroducing subpixel zoom jitter around text.
    filter+="[$index:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
    filter+="pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf7f2e9,"
    filter+="setsar=1,fps=30,trim=duration=$clip_duration,setpts=PTS-STARTPTS,format=yuv420p[v$index];"
    concat_inputs+="[v$index]"
    index="$(( index + 1 ))"
  done

  if ! awk -v expected="$duration" -v actual="$total_duration" \
    'BEGIN { difference = expected - actual; if (difference < 0) difference = -difference; exit(difference <= 0.002 ? 0 : 1) }'; then
    echo "Scene duration mismatch for $output: expected $duration, got $total_duration" >&2
    exit 1
  fi

  filter+="$concat_inputs"
  filter+="concat=n=$count:v=1:a=0,trim=duration=$duration,setpts=PTS-STARTPTS[v]"

  ffmpeg -y -v error "${ffmpeg_inputs[@]}" \
    -filter_complex "$filter" -map '[v]' -frames:v "$frames" -an \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
    -movflags +faststart "$output"
  echo "Created $output"
}

render_scene "${outputs[0]}" "${durations[0]}" \
  "$captures_dir/01-memory-center.png" "$(segment_span 1 2)" \
  "$captures_dir/15-memory-general-goal.png" "$(segment_span 3 4)"

render_scene "${outputs[1]}" "${durations[1]}" \
  "$captures_dir/14-diagnosis-general.png" "$(segment_span 5 6)" \
  "$captures_dir/15-memory-general-goal.png" "$(segment_span 7 8)"

render_scene "${outputs[2]}" "${durations[2]}" \
  "$captures_dir/14-diagnosis-general.png" "$(segment_span 9 9)" \
  "$captures_dir/13-natural-weakness-chat.png" "$(segment_span 10 12)" \
  "$captures_dir/08-coach-formats.png" "$(segment_span 13 15)" \
  "$captures_dir/09-picture-story.png" "$(segment_span 16 16)" \
  "$captures_dir/10-listen-retell.png" "$(segment_span 17 17)" \
  "$captures_dir/07-personalized-mission.png" "$(segment_span 18 18)" \
  "$captures_dir/11-chat-home-qwen.png" "$(segment_span 19 19)"

render_scene "${outputs[3]}" "${durations[3]}" \
  "$captures_dir/15-memory-general-goal.png" "$(segment_span 20 20)" \
  "$public_recall" "$(segment_span 21 22)" \
  "$captures_dir/05-archived-memories.png" "$(segment_span 23 23)" \
  "$captures_dir/15-memory-general-goal.png" "$(segment_span 24 24)"

render_scene "${outputs[4]}" "${durations[4]}" \
  "$captures_dir/06-todays-mission.png" "$(segment_span 25 25)" \
  "$captures_dir/03-memory-cards.png" "$(segment_span 26 26)" \
  "$captures_dir/06-todays-mission.png" "$(segment_span 27 27)" \
  "$captures_dir/07-personalized-mission.png" "$(segment_span 28 28)"
