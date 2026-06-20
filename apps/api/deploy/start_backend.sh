#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f ".env" ]]; then
  echo "Missing apps/api/.env. Copy .env.example to .env and fill production values first." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not on PATH." >&2
  exit 1
fi

docker compose build
docker compose run --rm api python -m scripts.create_table
docker compose up -d

python - <<'PY'
import json
import time
import urllib.request

url = "http://127.0.0.1:8000/api/v1/health"
last_error = None

for _ in range(30):
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload.get("status") == "ok":
            print("Backend is healthy at http://127.0.0.1:8000/api/v1/health")
            raise SystemExit(0)
    except Exception as exc:  # noqa: BLE001 - deployment script should report the last failure.
        last_error = exc
        time.sleep(2)

raise SystemExit(f"Backend did not become healthy: {last_error}")
PY
