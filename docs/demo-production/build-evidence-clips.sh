#!/usr/bin/env bash
set -euo pipefail

production_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$production_dir/../.." && pwd)"
assets_dir="$production_dir/output/evidence-cards"
clips_dir="$production_dir/clips"
font_regular="/System/Library/Fonts/Supplemental/Arial.ttf"
font_bold="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
font_mono="/System/Library/Fonts/Menlo.ttc"

mkdir -p "$assets_dir" "$clips_dir"

magick -size 880x880 xc:'#0f172a' \
  -font "$font_bold" -fill '#63e6be' -pointsize 26 \
  -gravity NorthWest -annotate +42+28 'WEAKSPOT SYSTEM FLOW' \
  -fill '#312e81' -stroke '#818cf8' -strokewidth 2 \
  -draw 'roundrectangle 70,90 810,205 18,18' \
  -stroke none -fill white -pointsize 30 -annotate +250+118 'Browser + Next.js' \
  -font "$font_regular" -fill '#c7d2fe' -pointsize 20 \
  -annotate +277+160 'learner experience' \
  -fill '#64748b' -draw 'rectangle 434,205 446,244' \
  -draw 'polygon 422,244 458,244 440,268' \
  -fill '#064e3b' -stroke '#34d399' -strokewidth 2 \
  -draw 'roundrectangle 70,270 810,410 18,18' \
  -stroke none -font "$font_bold" -fill white -pointsize 30 \
  -annotate +230+300 'Alibaba Cloud ECS' \
  -font "$font_regular" -fill '#a7f3d0' -pointsize 21 \
  -annotate +214+350 'Docker · Nginx · FastAPI' \
  -fill '#64748b' -draw 'rectangle 434,410 446,454' \
  -draw 'polygon 422,454 458,454 440,478' \
  -fill '#3b1d5a' -stroke '#c084fc' -strokewidth 2 \
  -draw 'roundrectangle 70,480 410,665 18,18' \
  -stroke none -font "$font_bold" -fill white -pointsize 25 \
  -annotate +125+512 'Qwen Cloud' \
  -font "$font_regular" -fill '#e9d5ff' -pointsize 19 \
  -annotate +110+558 'qwen3.7-max · plus' \
  -annotate +97+600 'text-embedding-v4' \
  -fill '#1e3a5f' -stroke '#60a5fa' -strokewidth 2 \
  -draw 'roundrectangle 470,480 810,665 18,18' \
  -stroke none -font "$font_bold" -fill white -pointsize 25 \
  -annotate +525+512 'MemoryAgent' \
  -font "$font_regular" -fill '#bfdbfe' -pointsize 19 \
  -annotate +512+558 'extract · rank · recall' \
  -annotate +521+600 'merge · supersede' \
  -fill '#64748b' -draw 'rectangle 410,565 470,577' \
  -draw 'polygon 446,553 470,571 446,589' \
  -fill '#64748b' -draw 'rectangle 634,665 646,716' \
  -draw 'polygon 622,716 658,716 640,740' \
  -fill '#172554' -stroke '#38bdf8' -strokewidth 2 \
  -draw 'roundrectangle 225,742 655,842 18,18' \
  -stroke none -font "$font_bold" -fill white -pointsize 24 \
  -annotate +355+765 'DynamoDB' \
  -font "$font_regular" -fill '#bae6fd' -pointsize 18 \
  -annotate +277+805 'MEMORY# · MEMTRACE#' \
  "$assets_dir/architecture-panel.png"

magick -size 1920x1080 xc:'#0b1220' \
  "$assets_dir/architecture-panel.png" -geometry +70+120 -composite \
  -font "$font_bold" -fill '#63e6be' -pointsize 32 \
  -gravity NorthWest -annotate +70+55 'ALIBABA CLOUD DEPLOYMENT' \
  -fill white -pointsize 54 -annotate +1020+175 'A memory-first Qwen agent' \
  -font "$font_regular" -fill '#cbd5e1' -pointsize 34 \
  -annotate +1020+285 'Next.js web application' \
  -annotate +1020+350 'FastAPI in Docker on ECS' \
  -annotate +1020+415 'Qwen 3.7 Max + Plus' \
  -annotate +1020+480 'text-embedding-v4 · 256d' \
  -annotate +1020+545 'DynamoDB persistent memory' \
  -fill '#94a3b8' -pointsize 26 \
  -annotate +1020+690 'Hybrid recall · lifecycle rules · audit traces' \
  "$assets_dir/06-architecture.png"

magick -size 1920x1080 xc:'#07111f' \
  -fill '#111c2d' -stroke '#263449' -strokewidth 2 \
  -draw 'roundrectangle 105,135 1815,925 28,28' \
  -stroke none -font "$font_bold" -fill '#63e6be' -pointsize 32 \
  -gravity NorthWest -annotate +150+80 'DEPLOYMENT PROOF' \
  -font "$font_mono" -fill '#e2e8f0' -pointsize 34 \
  -annotate +170+205 '$ GET /api/v1/health' \
  -fill '#86efac' -annotate +170+265 '200 OK  { "status": "healthy" }' \
  -fill '#e2e8f0' -annotate +170+360 '$ Qwen model routing' \
  -fill '#93c5fd' -annotate +170+420 'deep     qwen3.7-max' \
  -annotate +170+475 'fast     qwen3.7-plus' \
  -annotate +170+530 'memory   text-embedding-v4  (256d)' \
  -fill '#e2e8f0' -annotate +170+625 '$ Durable memory keys' \
  -fill '#fcd34d' -annotate +170+685 'MEMORY#...    MEMTRACE#...' \
  -font "$font_regular" -fill '#94a3b8' -pointsize 26 \
  -annotate +170+820 'ECS → FastAPI → Qwen → MemoryAgent → DynamoDB' \
  "$assets_dir/06-deployment-proof.png"

magick -size 1920x1080 xc:'#07111f' \
  -fill '#111c2d' -stroke '#263449' -strokewidth 2 \
  -draw 'roundrectangle 105,115 1815,950 28,28' \
  -stroke none -font "$font_bold" -fill '#63e6be' -pointsize 32 \
  -gravity NorthWest -annotate +150+65 'REPRODUCIBLE MEMORYAGENT BENCHMARK' \
  -font "$font_mono" -fill '#cbd5e1' -pointsize 31 \
  -annotate +165+180 '$ python -m scripts.memory_benchmark' \
  -fill '#94a3b8' -annotate +165+245 '{' \
  -annotate +210+300 '"mode": "lexical-fallback",' \
  -fill '#86efac' -annotate +210+355 '"recallAt6": 1.0,' \
  -annotate +210+410 '"staleSuppression": true,' \
  -annotate +210+465 '"budgetCompliance": true,' \
  -fill '#fcd34d' -annotate +210+520 '"contextReduction": 0.826,' \
  -fill '#94a3b8' -annotate +210+575 '"tokenBudget": 220' \
  -annotate +165+630 '}' \
  -font "$font_bold" -fill '#63e6be' -pointsize 43 \
  -annotate +165+745 'MEMORY BENCHMARK PASSED' \
  -font "$font_regular" -fill '#94a3b8' -pointsize 25 \
  -annotate +165+850 'Fresh run from the current repository revision' \
  "$assets_dir/07-benchmark.png"

magick -size 1920x1080 xc:'#0b1220' \
  -fill '#172235' -draw 'circle 960,360 960,245' \
  -font "$font_bold" -fill '#63e6be' -pointsize 34 \
  -gravity North -annotate +0+125 'QWEN MEMORYAGENT' \
  -fill white -pointsize 72 -gravity Center \
  -annotate +0-15 'WeakSpot English Coach' \
  -font "$font_regular" -fill '#cbd5e1' -pointsize 34 \
  -annotate +0+80 'Remember not only mistakes — remember what works.' \
  -fill '#93c5fd' -pointsize 28 \
  -gravity South -annotate +0+150 'github.com/jinyu-cai/weakspot-english-coach' \
  -fill '#94a3b8' -pointsize 24 -annotate +0+105 'Open source · MIT License' \
  "$assets_dir/07-close.png"

ffmpeg -y \
  -loop 1 -t 4 -i "$assets_dir/06-architecture.png" \
  -loop 1 -t 4 -i "$assets_dir/06-deployment-proof.png" \
  -loop 1 -t 4 -i "$production_dir/output/browser-captures/11-chat-home-qwen.png" \
  -loop 1 -t 4 -i "$production_dir/output/browser-captures/08-qwen-model-marketplace.png" \
  -loop 1 -t 4 -i "$production_dir/output/browser-captures/09-qwen-cloud-console.png" \
  -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,fps=30,setsar=1,format=yuv420p[a];\
   [1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,fps=30,setsar=1,format=yuv420p[b];\
   [2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,fps=30,setsar=1,format=yuv420p[c];\
   [3:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,fps=30,setsar=1,format=yuv420p[d];\
   [4:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,fps=30,setsar=1,format=yuv420p[e];\
   [a][b][c][d][e]concat=n=5:v=1:a=0[v]" \
  -map '[v]' -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -movflags +faststart "$clips_dir/06-architecture.mp4"

ffmpeg -y \
  -loop 1 -t 11 -i "$assets_dir/07-benchmark.png" \
  -loop 1 -t 9 -i "$assets_dir/07-close.png" \
  -filter_complex \
  "[0:v]fps=30,setsar=1,format=yuv420p[a];\
   [1:v]fps=30,setsar=1,format=yuv420p[b];\
   [a][b]concat=n=2:v=1:a=0[v]" \
  -map '[v]' -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -movflags +faststart "$clips_dir/07-close.mp4"

echo "Created $clips_dir/06-architecture.mp4"
echo "Created $clips_dir/07-close.mp4"
