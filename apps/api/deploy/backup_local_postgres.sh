#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

backup_dir="${BACKUP_DIR:-/srv/weakspot-backups/postgres}"
retention_days="${BACKUP_RETENTION_DAYS:-7}"

if [[ "$backup_dir" != /* || "$backup_dir" == "/" ]]; then
  echo "BACKUP_DIR must be an absolute directory other than /." >&2
  exit 1
fi
if [[ ! "$retention_days" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_RETENTION_DAYS must be a positive integer." >&2
  exit 1
fi
if [[ ! -f ".env" ]]; then
  echo "Missing apps/api/.env." >&2
  exit 1
fi

umask 077
mkdir -p "$backup_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
final_path="$backup_dir/weakspot-$timestamp.dump"
temporary_path="$backup_dir/.weakspot-$timestamp.dump.tmp"

cleanup_temporary() {
  rm -f -- "$temporary_path"
}
trap cleanup_temporary EXIT

database_bytes="$(
  docker compose exec -T postgres sh -eu -c \
    'exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "SELECT pg_database_size(current_database())"'
)"
available_kb="$(df -Pk "$backup_dir" | awk 'NR == 2 { print $4 }')"
if [[ ! "$database_bytes" =~ ^[0-9]+$ || ! "$available_kb" =~ ^[0-9]+$ ]]; then
  echo "Could not determine database size or free backup space." >&2
  exit 1
fi
if (( available_kb * 1024 < database_bytes )); then
  echo "Backup filesystem has less free space than the current database size." >&2
  exit 1
fi

docker compose exec -T postgres sh -eu -c \
  'exec pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  >"$temporary_path"

if [[ ! -s "$temporary_path" ]]; then
  echo "PostgreSQL produced an empty backup." >&2
  exit 1
fi
docker compose exec -T postgres pg_restore --list <"$temporary_path" >/dev/null
mv -- "$temporary_path" "$final_path"
chmod 0600 "$final_path"
trap - EXIT

find "$backup_dir" -type f -name 'weakspot-*.dump' \
  -mmin "+$((retention_days * 1440))" -delete
echo "Verified PostgreSQL backup: $final_path"
