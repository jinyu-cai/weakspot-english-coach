#!/usr/bin/env bash
set -euo pipefail

production_dir="$(cd "$(dirname "$0")" && pwd)"
clips_dir="$production_dir/clips"
output_dir="$production_dir/output"
qwen_mastered_voiceover="$output_dir/voiceover-qwen-mastered.m4a"
qwen_voiceover="$output_dir/voiceover-qwen.mp3"
fallback_voiceover="$output_dir/voiceover-en.m4a"
aligned_subtitles="$output_dir/subtitles-qwen.srt"
aligned_chinese_subtitles="$output_dir/subtitles-zh.srt"
fallback_subtitles="$production_dir/subtitles-en.srt"
final_video="$output_dir/weakspot-demo-final.mp4"

mkdir -p "$output_dir"

clips=(
  "$clips_dir/01-hook.mp4"
  "$clips_dir/02-accumulation.mp4"
  "$clips_dir/03-recall.mp4"
  "$clips_dir/04-forgetting.mp4"
  "$clips_dir/05-decision.mp4"
  "$clips_dir/06-architecture.mp4"
  "$clips_dir/07-close.mp4"
)
durations=(16 32 28 23 28 27 20)

timeline="$output_dir/timeline-qwen.json"
if [[ -f "$timeline" ]] && command -v jq >/dev/null 2>&1; then
  durations=()
  while IFS= read -r duration; do
    durations+=("$duration")
  done < <(jq -r '.scenes[].duration' "$timeline")
fi

for clip in "${clips[@]}"; do
  if [[ ! -f "$clip" ]]; then
    echo "Missing recording: $clip" >&2
    exit 1
  fi
done

if [[ -f "$qwen_mastered_voiceover" ]]; then
  voiceover="$qwen_mastered_voiceover"
elif [[ -f "$qwen_voiceover" ]]; then
  voiceover="$qwen_voiceover"
elif [[ -f "$fallback_voiceover" ]]; then
  voiceover="$fallback_voiceover"
else
  echo "Missing narration audio." >&2
  echo "Run generate-qwen-voiceover.sh or render-placeholder.sh first." >&2
  exit 1
fi

if [[ -f "$aligned_subtitles" ]]; then
  subtitles="$aligned_subtitles"
else
  subtitles="$fallback_subtitles"
fi

subtitle_inputs=( -i "$subtitles" )
subtitle_maps=( -map 8:0 )
subtitle_options=(
  -metadata:s:s:0 language=eng
  -metadata:s:s:0 title="English"
  -disposition:s:0 default
)
if [[ -f "$aligned_chinese_subtitles" ]]; then
  subtitle_inputs+=( -i "$aligned_chinese_subtitles" )
  subtitle_maps=( -map 9:0 -map 8:0 )
  subtitle_options=(
    -metadata:s:s:0 language=zho
    -metadata:s:s:0 title="简体中文"
    -metadata:s:s:1 language=eng
    -metadata:s:s:1 title="English"
    -disposition:s:0 default
    -disposition:s:1 0
  )
fi

filter=""
for index in "${!clips[@]}"; do
  duration="${durations[$index]}"
  filter+="[$index:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
  filter+="pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,"
  filter+="setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=$duration,"
  filter+="trim=duration=$duration,setpts=PTS-STARTPTS[v$index];"
done
filter+="[v0][v1][v2][v3][v4][v5][v6]concat=n=7:v=1:a=0,format=yuv420p[video]"

ffmpeg -y \
  -i "${clips[0]}" -i "${clips[1]}" -i "${clips[2]}" \
  -i "${clips[3]}" -i "${clips[4]}" -i "${clips[5]}" \
  -i "${clips[6]}" -i "$voiceover" "${subtitle_inputs[@]}" \
  -filter_complex "$filter" \
  -map "[video]" -map 7:a "${subtitle_maps[@]}" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 \
  -c:s mov_text "${subtitle_options[@]}" \
  -t 174 -movflags +faststart "$final_video"

echo "Created $final_video"
