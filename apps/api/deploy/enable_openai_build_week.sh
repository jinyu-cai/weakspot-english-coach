#!/usr/bin/env bash
set -euo pipefail

api_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${api_dir}/.env"

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}; refusing to enable the OpenAI Build Week path." >&2
  exit 1
fi

if ! grep -Eq '^(OPENAI_API_KEY|OPENAI_BUILD_WEEK_API_KEY)=.{10,}$' "${env_file}"; then
  echo "No configured server-side OpenAI API key; refusing to enable the feature." >&2
  exit 1
fi

backup="${env_file}.backup-before-openai-build-week-$(date -u +%Y%m%dT%H%M%SZ)"
cp "${env_file}" "${backup}"
chmod --reference="${env_file}" "${backup}"

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${env_file}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${env_file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${env_file}"
  fi
}

upsert_env OPENAI_BUILD_WEEK_ENABLED true
upsert_env OPENAI_BUILD_WEEK_BASE_URL https://api.openai.com/v1
upsert_env OPENAI_BUILD_WEEK_MODEL gpt-5.6-sol
upsert_env OPENAI_BUILD_WEEK_REASONING_EFFORT medium
upsert_env OPENAI_BUILD_WEEK_TIMEOUT_SECONDS 180

echo "Enabled OpenAI Build Week GPT-5.6 configuration."
echo "Backup: ${backup}"
