#!/usr/bin/env bash
set -euo pipefail

production_dir="$(cd "$(dirname "$0")" && pwd)"
output_dir="$production_dir/output"
captures_dir="$output_dir/captures"
cards_dir="$output_dir/cards"
clips_dir="$output_dir/clips"
recordings_dir="$output_dir/recordings"
timeline="$output_dir/timeline-qwen.json"
audio="$output_dir/voiceover-qwen-mastered.m4a"
subtitles_zh="$output_dir/subtitles-zh.srt"
subtitles_en="$output_dir/subtitles-qwen.srt"
final_video="$output_dir/weakspot-openai-build-week-final.mp4"

for command in ffmpeg ffprobe jq; do
  command -v "$command" >/dev/null 2>&1 || { echo "Missing command: $command" >&2; exit 1; }
done

for required in "$timeline" "$audio" "$subtitles_zh" "$subtitles_en"; do
  [[ -f "$required" ]] || { echo "Missing required file: $required" >&2; exit 1; }
done

mkdir -p "$clips_dir"

duration_for() {
  jq -r --argjson index "$1" '.segments[$index - 1].end - .segments[$index - 1].start' "$timeline"
}

render_still() {
  local index="$1"
  local image="$2"
  local duration
  duration="$(duration_for "$index")"
  [[ -f "$image" ]] || { echo "Missing visual: $image" >&2; exit 1; }
  ffmpeg -loglevel error -y -loop 1 -t "$duration" -i "$image" \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,setsar=1,fps=30,format=yuv420p" \
    -an -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
    "$clips_dir/$(printf '%02d' "$index").mp4"
}

render_multi() {
  local index="$1"
  shift
  local duration
  local count="$#"
  local part
  local filter=""
  local concat_inputs=""
  local input_args=()
  local image
  local position=0

  duration="$(duration_for "$index")"
  part="$(awk -v duration="$duration" -v count="$count" 'BEGIN { printf "%.9f", duration / count }')"
  for image in "$@"; do
    [[ -f "$image" ]] || { echo "Missing visual: $image" >&2; exit 1; }
    input_args+=( -loop 1 -t "$part" -i "$image" )
    filter+="[$position:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
    filter+="pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,setsar=1,fps=30,"
    filter+="trim=duration=$part,setpts=PTS-STARTPTS,format=yuv420p[v$position];"
    concat_inputs+="[v$position]"
    position="$(( position + 1 ))"
  done
  filter+="$concat_inputs"
  filter+="concat=n=$count:v=1:a=0,tpad=stop_mode=clone:stop_duration=1,trim=duration=$duration,format=yuv420p[v]"

  ffmpeg -loglevel error -y "${input_args[@]}" -filter_complex "$filter" -map '[v]' \
    -an -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
    "$clips_dir/$(printf '%02d' "$index").mp4"
}

render_recording() {
  local index="$1"
  local recording="$2"
  local source_start="${3:-0}"
  local duration
  duration="$(duration_for "$index")"
  [[ -f "$recording" ]] || { echo "Missing recording: $recording" >&2; exit 1; }
  ffmpeg -loglevel error -y -ss "$source_start" -i "$recording" \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=$duration,trim=duration=$duration,setpts=PTS-STARTPTS,format=yuv420p" \
    -an -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
    "$clips_dir/$(printf '%02d' "$index").mp4"
}

# Every cut starts at a real narration sentence boundary. Product sections use
# continuous frames captured from the live browser while navigation, selection,
# generation, messaging, scrolling, recall, pinning, and editing actually run.
# Evidence cards remain fixed and use hard cuts only, so there is no synthetic
# pan/zoom jitter.
render_recording 1 "$recordings_dir/01-navigation.mp4" 0
render_recording 2 "$recordings_dir/01-navigation.mp4" 4
render_still 3 "$cards_dir/03-build-week-title.png"
render_recording 4 "$recordings_dir/02-mission-setup-loading.mp4" 0
render_still 5 "$cards_dir/05-scheduler.png"
render_recording 6 "$recordings_dir/02-mission-setup-loading.mp4" 5.8
render_recording 7 "$recordings_dir/02-mission-result.mp4" 0
render_recording 8 "$recordings_dir/02-mission-result.mp4" 9.667
render_still 9 "$cards_dir/09-structured-output.png"
render_recording 10 "$recordings_dir/03-formats.mp4" 0
render_recording 11 "$recordings_dir/04-chat.mp4" 0
render_recording 12 "$recordings_dir/04-chat.mp4" 23
render_still 13 "$cards_dir/13-evidence-loop.png"
render_recording 14 "$recordings_dir/05-recall.mp4" 3.5
render_recording 15 "$recordings_dir/05-memory-controls.mp4" 2.5
render_still 16 "$captures_dir/16-github-pr.png"
render_multi 17 "$cards_dir/17-code.png" "$cards_dir/17-tests.png"
render_still 18 "$cards_dir/18-architecture.png"
render_still 19 "$cards_dir/19-health.png"
render_multi 20 "$captures_dir/07-gpt56-mission.png" "$cards_dir/20-end.png"

concat_file="$clips_dir/concat.txt"
: > "$concat_file"
for index in $(seq 1 20); do
  printf "file '%s/%02d.mp4'\n" "$clips_dir" "$index" >> "$concat_file"
done

ffmpeg -loglevel error -y -f concat -safe 0 -i "$concat_file" -c copy "$output_dir/video-silent.mp4"

ffmpeg -loglevel error -y \
  -i "$output_dir/video-silent.mp4" -i "$audio" -i "$subtitles_zh" -i "$subtitles_en" \
  -map 0:v:0 -map 1:a:0 -map 2:0 -map 3:0 \
  -metadata:s:s:0 language=zho -metadata:s:s:0 title='简体中文' -disposition:s:0 default \
  -metadata:s:s:1 language=eng -metadata:s:s:1 title='English' \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -c:s mov_text \
  -t 174 -movflags +faststart "$final_video"

echo "Created $final_video"
ffprobe -v error -show_entries format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels:stream_tags=language,title \
  -of json "$final_video"
