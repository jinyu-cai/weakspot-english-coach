#!/usr/bin/env bash
set -euo pipefail

production_dir="$(cd "$(dirname "$0")" && pwd)"
venv_dir="$production_dir/.venv"
cache_dir="$production_dir/.uv-cache"
python="$venv_dir/bin/python"

if [[ ! -x "$python" ]]; then
  UV_CACHE_DIR="$cache_dir" uv venv "$venv_dir"
fi

if ! "$python" -c 'import dashscope' >/dev/null 2>&1; then
  UV_CACHE_DIR="$cache_dir" uv pip install --python "$python" 'dashscope>=1.25.2'
fi

exec "$python" "$production_dir/generate-qwen-voiceover.py" "$@"
