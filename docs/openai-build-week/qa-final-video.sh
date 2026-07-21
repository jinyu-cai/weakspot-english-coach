#!/usr/bin/env bash
set -euo pipefail

production_dir="$(cd "$(dirname "$0")" && pwd)"
output_dir="$production_dir/output"
video="$output_dir/weakspot-openai-build-week-final.mp4"
timeline="$output_dir/timeline-qwen.json"
qa_dir="$output_dir/qa"
frames_dir="$qa_dir/frames"
font_regular="/System/Library/Fonts/Supplemental/Arial.ttf"

for command in ffmpeg ffprobe jq magick; do
  command -v "$command" >/dev/null 2>&1 || { echo "Missing command: $command" >&2; exit 1; }
done

[[ -f "$video" ]] || { echo "Missing final video: $video" >&2; exit 1; }
mkdir -p "$frames_dir"

duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$video")"
awk -v duration="$duration" 'BEGIN { exit(duration >= 173.9 && duration <= 180.0 ? 0 : 1) }' || {
  echo "Unexpected duration: $duration" >&2
  exit 1
}

segment_count="$(jq '.segments | length' "$timeline")"
english_cues="$(grep -Ec '^[0-9]+$' "$output_dir/subtitles-qwen.srt")"
chinese_cues="$(grep -Ec '^[0-9]+$' "$output_dir/subtitles-zh.srt")"
[[ "$segment_count" == 20 && "$english_cues" == 20 && "$chinese_cues" == 20 ]] || {
  echo "Cue mismatch: segments=$segment_count en=$english_cues zh=$chinese_cues" >&2
  exit 1
}

for index in $(seq 1 20); do
  midpoint="$(jq -r --argjson index "$index" '(.segments[$index - 1].start + .segments[$index - 1].end) / 2' "$timeline")"
  ffmpeg -loglevel error -y -ss "$midpoint" -i "$video" -frames:v 1 "$frames_dir/$(printf '%02d' "$index").png"
done

magick montage -font "$font_regular" "$frames_dir"/*.png \
  -thumbnail 480x270 -tile 4x -geometry +8+8 -background '#0b1220' \
  "$qa_dir/sentence-midpoints.jpg"

silence_log="$qa_dir/silence.log"
ffmpeg -hide_banner -i "$video" -af silencedetect=noise=-45dB:d=0.8 -f null - 2> "$silence_log" || true
long_silence_count="$(grep -c 'silence_start' "$silence_log" || true)"

echo "FINAL VIDEO QA PASSED"
echo "duration=$duration"
echo "segments=$segment_count english_cues=$english_cues chinese_cues=$chinese_cues"
echo "long_silences=$long_silence_count"
echo "contact_sheet=$qa_dir/sentence-midpoints.jpg"
