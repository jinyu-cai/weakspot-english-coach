#!/usr/bin/env bash
set -euo pipefail

production_dir="$(cd "$(dirname "$0")" && pwd)"
input="$production_dir/output/voiceover-qwen.mp3"
output="$production_dir/output/voiceover-qwen-mastered.m4a"
target_duration="174"

if [[ ! -f "$input" ]]; then
  echo "Missing Qwen narration: $input" >&2
  echo "Run generate-qwen-voiceover.sh first." >&2
  exit 1
fi

source_duration="$(
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$input"
)"
tempo="$(
  awk -v source="$source_duration" -v target="$target_duration" \
    'BEGIN { printf "%.8f", source / target }'
)"

awk -v tempo="$tempo" \
  'BEGIN { if (tempo < 0.5 || tempo > 2.0) exit 1 }' || {
  echo "Required tempo ratio $tempo is outside ffmpeg atempo range." >&2
  exit 1
}

ffmpeg -y -i "$input" \
  -af "atempo=$tempo,loudnorm=I=-16:LRA=7:TP=-1.5,apad=pad_dur=$target_duration" \
  -t "$target_duration" -c:a aac -b:a 192k -ar 48000 "$output"

echo "Created $output (source ${source_duration}s, tempo ${tempo}x)"
