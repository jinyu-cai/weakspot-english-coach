#!/usr/bin/env bash
set -euo pipefail

production_dir="$(cd "$(dirname "$0")" && pwd)"
output_dir="$production_dir/output"
cards_dir="$output_dir/placeholder-cards"
narration_txt="$production_dir/voiceover-en.txt"
narration_aiff="$output_dir/voiceover-en.aiff"
narration_m4a="$output_dir/voiceover-en.m4a"
qwen_mastered="$output_dir/voiceover-qwen-mastered.m4a"
aligned_subtitles="$output_dir/subtitles-qwen.srt"
preview_video="$output_dir/weakspot-demo-timing-preview.mp4"
font="/System/Library/Fonts/Supplemental/Arial.ttf"

mkdir -p "$cards_dir"

titles=(
  "01  PROBLEM + MEMORYAGENT"
  "02  AUTONOMOUS MEMORY ACCUMULATION"
  "03  BOUNDED CROSS-SESSION RECALL"
  "04  REPLACEMENT + FORGETTING"
  "05  OUTCOME-DRIVEN NEXT ACTION"
  "06  ALIBABA CLOUD + QWEN ARCHITECTURE"
  "07  BENCHMARK + CLOSE"
)
durations=(16 32 28 23 28 27 20)

timeline="$output_dir/timeline-qwen.json"
if [[ -f "$timeline" ]] && command -v jq >/dev/null 2>&1; then
  durations=()
  while IFS= read -r duration; do
    durations+=("$duration")
  done < <(jq -r '.scenes[].duration' "$timeline")
fi

for index in "${!titles[@]}"; do
  number="$(printf '%02d' "$((index + 1))")"
  magick -size 1920x1080 xc:'#0b1220' \
    -font "$font" -fill '#63e6be' -pointsize 34 \
    -gravity NorthWest -annotate +110+100 'WeakSpot English Coach' \
    -fill white -pointsize 58 -gravity Center \
    -annotate +0-20 "${titles[$index]}" \
    -fill '#94a3b8' -pointsize 26 -gravity South \
    -annotate +0+100 'Replace this card with the corresponding real screen recording' \
    "$cards_dir/$number.png"
done

if [[ -f "$qwen_mastered" ]]; then
  narration="$qwen_mastered"
else
  if ! ffprobe -v error -show_entries format=duration -of csv=p=0 "$narration_aiff" 2>/dev/null | grep -q '[0-9]'; then
    say -v Samantha -r 155 -f "$narration_txt" -o "$narration_aiff"
  fi
  ffmpeg -y -i "$narration_aiff" -af "atempo=1.045,apad=pad_dur=174" -t 174 \
    -c:a aac -b:a 192k -ar 48000 "$narration_m4a"
  narration="$narration_m4a"
fi

if [[ -f "$aligned_subtitles" ]]; then
  subtitles="$aligned_subtitles"
else
  subtitles="$production_dir/subtitles-en.srt"
fi

inputs=()
filter=""
for index in "${!titles[@]}"; do
  number="$(printf '%02d' "$((index + 1))")"
  duration="${durations[$index]}"
  evidence_clip="$production_dir/clips/$number-$([[ "$number" == "06" ]] && echo architecture || echo close).mp4"
  if [[ "$number" == "06" || "$number" == "07" ]] && [[ -f "$evidence_clip" ]]; then
    inputs+=( -i "$evidence_clip" )
  else
    inputs+=( -loop 1 -t "$duration" -i "$cards_dir/$number.png" )
  fi
  filter+="[$index:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
  filter+="pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,"
  filter+="setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=$duration,"
  filter+="trim=duration=$duration,format=yuv420p,setpts=PTS-STARTPTS[v$index];"
done
filter+="[v0][v1][v2][v3][v4][v5][v6]concat=n=7:v=1:a=0,format=yuv420p[video]"

ffmpeg -y "${inputs[@]}" -i "$narration" -i "$subtitles" \
  -filter_complex "$filter" -map "[video]" -map 7:a -map 8:0 \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -c:s mov_text -metadata:s:s:0 language=eng \
  -disposition:s:0 default \
  -t 174 -movflags +faststart "$preview_video"

echo "Created $preview_video"
