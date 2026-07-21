#!/usr/bin/env bash
set -euo pipefail

PACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OLD_PACK_DIR="$(cd "${PACK_DIR}/../demo-production" && pwd)"

bash "${OLD_PACK_DIR}/generate-qwen-segmented.sh" \
  --env "${OLD_PACK_DIR}/.env" \
  --input "${PACK_DIR}/voiceover-en.txt" \
  --output-dir "${PACK_DIR}/output" \
  --target-duration 174 \
  --scene-sentence-counts 2,4,3,3,3,3,2 \
  "$@"

if [[ " ${*:-} " != *" --dry-run "* ]]; then
  python3 "${PACK_DIR}/align-zh-subtitles.py"
fi
