# Server-local PostgreSQL production runbook

WeakSpot production keeps PostgreSQL 16 but runs it in Docker on the same
Oracle server as the FastAPI container. This removes the RDS instance from the
normal request path without changing the application schema or repository
code. The database has no published host port; only containers on the Compose
network can connect to it.

The production data is stored in the Docker volume
`weakspot-postgres-data`. Never run `docker compose down -v`, remove that
volume, or use any cleanup command that removes unused volumes.

## 1. Prepare the server

Use a maintenance window. Before the window, measure the RDS database and the
server filesystem. Free space must cover the restored database, two complete
dump files, and another 20 percent of headroom.

```bash
df -h /var/lib/docker /srv
docker --version
docker compose version
```

Create protected working directories. Adjust the application path below to
the real deployment location.

```bash
sudo install -d -m 0700 -o "$USER" -g "$(id -gn)" /srv/weakspot-migration
sudo install -d -m 0700 -o "$USER" -g "$(id -gn)" /srv/weakspot-backups/postgres
cd /srv/weakspot/apps/api
```

Keep the current deployment and environment for rollback. Do not put these
copies inside the Git repository or a web-served directory.

```bash
sudo cp -a . /srv/weakspot-rollback-pre-local-postgres
sudo chmod -R go-rwx /srv/weakspot-rollback-pre-local-postgres
```

In AWS, confirm the latest automated RDS backup is healthy. Keep the RDS
instance online and unchanged throughout the seven-day rollback window.

## 2. Export RDS without exposing its password

Use the PostgreSQL 16 client image. The temporary password file and RDS CA
bundle prevent the password from appearing in command arguments or shell
history.

```bash
export RDS_HOST='REPLACE_RDS_ENDPOINT'
export RDS_PORT='5432'
export RDS_DB='weakspot'
export RDS_USER='weakspot_app'
read -s RDS_PASSWORD
RDS_PASSWORD_FILE="$(mktemp)"
export RDS_PASSWORD_FILE
chmod 0600 "$RDS_PASSWORD_FILE"
printf '%s' "$RDS_PASSWORD" >"$RDS_PASSWORD_FILE"
unset RDS_PASSWORD
cleanup_rds_password() { rm -f -- "$RDS_PASSWORD_FILE"; }
trap cleanup_rds_password EXIT
```

Read the exact source size in bytes and confirm the free-space requirement from
section 1 before entering maintenance:

```bash
docker run --rm \
  -v "$RDS_PASSWORD_FILE:/run/secrets/rds.password:ro" \
  -v "$PWD/deploy/certs/global-bundle.pem:/run/secrets/rds-ca-bundle.pem:ro" \
  -e PGHOST="$RDS_HOST" -e PGPORT="$RDS_PORT" \
  -e PGDATABASE="$RDS_DB" -e PGUSER="$RDS_USER" \
  -e PGSSLMODE=verify-full \
  -e PGSSLROOTCERT=/run/secrets/rds-ca-bundle.pem \
  postgres:16-alpine \
  sh -eu -c 'export PGPASSWORD="$(cat /run/secrets/rds.password)"; exec psql --tuples-only --no-align --command "SELECT pg_database_size(current_database())"'
```

Put Nginx or Cloudflare into maintenance mode, stop the API, and confirm there
are no background writers. The stopped API is what makes the final dump and
the later digest comparison consistent.

```bash
docker stop weakspot-api
```

Immediately request a final manual RDS snapshot and record its identifier. The
dump and restore may proceed while the read-only snapshot completes, but do not
remove maintenance mode until the snapshot status is `available`.

Create and inspect the final custom-format dump:

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$RDS_PASSWORD_FILE:/run/secrets/rds.password:ro" \
  -v "$PWD/deploy/certs/global-bundle.pem:/run/secrets/rds-ca-bundle.pem:ro" \
  -v /srv/weakspot-migration:/backup \
  -e PGHOST="$RDS_HOST" -e PGPORT="$RDS_PORT" \
  -e PGDATABASE="$RDS_DB" -e PGUSER="$RDS_USER" \
  -e PGSSLMODE=verify-full \
  -e PGSSLROOTCERT=/run/secrets/rds-ca-bundle.pem \
  postgres:16-alpine \
  sh -eu -c 'export PGPASSWORD="$(cat /run/secrets/rds.password)"; exec pg_dump --format=custom --no-owner --no-acl --file /backup/rds-final.dump'

docker run --rm \
  -v /srv/weakspot-migration:/backup:ro \
  postgres:16-alpine \
  pg_restore --list /backup/rds-final.dump >/dev/null
```

## 3. Initialize and restore the local database

Use the atomic environment helper. It preserves the current RDS environment in
a permission-restricted rollback file, keeps all unrelated model/OAuth/session
settings, generates the database password without printing it, and refuses to
rotate the password if the file already points at local PostgreSQL:

```bash
python3 deploy/configure_local_postgres.py .env
```

The resulting file uses `POSTGRES_DB=weakspot`,
`POSTGRES_USER=weakspot_app`, and the private `postgres:5432` hostname. Do not
start PostgreSQL from the unedited example template: its placeholder password
would initialize the persistent volume with unusable credentials.

Start only PostgreSQL and restore the dump. This command is intentionally run
while the API remains stopped.

```bash
docker compose config --quiet
docker compose up -d postgres
docker compose exec -T postgres sh -eu -c \
  'exec pg_restore --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl --exit-on-error' \
  </srv/weakspot-migration/rds-final.dump
```

Compare every application table before accepting writes. Build a source URL
without a password; the verifier reads it from the protected file instead.

```bash
export SOURCE_DATABASE_URL="postgresql+psycopg://$RDS_USER@$RDS_HOST:$RDS_PORT/$RDS_DB?sslmode=verify-full&sslrootcert=/run/secrets/rds-ca-bundle.pem"
docker compose run --rm \
  -v "$RDS_PASSWORD_FILE:/run/secrets/rds.password:ro" \
  -v "$PWD/deploy/certs/global-bundle.pem:/run/secrets/rds-ca-bundle.pem:ro" \
  -e SOURCE_DATABASE_PASSWORD_FILE=/run/secrets/rds.password \
  -e SOURCE_DATABASE_URL \
  api python -m scripts.verify_postgres_copy
unset SOURCE_DATABASE_URL
```

The command must report matching PostgreSQL major versions, Alembic revisions,
row counts, and SHA-256 row digests for every application table. It never
prints database URLs or learner content.

Remove the temporary RDS password file now that source/target verification has
finished:

```bash
rm -f -- "$RDS_PASSWORD_FILE"
trap - EXIT
unset RDS_PASSWORD_FILE RDS_HOST RDS_PORT RDS_DB RDS_USER
```

## 4. Start production and verify persistence

```bash
./deploy/start_backend.sh
curl --fail http://127.0.0.1:8000/api/v1/health/ready
curl --fail https://enapi.jinxxx.de/api/v1/health/ready
```

Verify login plus Profile, History, Plan, Memory, Chat, Ebook, Diagnose, and a
Practice submission before removing maintenance mode. Then restart both
containers and repeat the readiness and persisted-read checks:

```bash
docker compose restart postgres
docker compose up -d --wait postgres
docker compose restart api
```

## 5. Daily local backups

Install the root cron entry below. The backup helper checks free space, creates
a PostgreSQL custom-format dump, validates its archive, atomically publishes
it with mode `0600`, and removes files older than seven days.

```cron
30 3 * * * cd /srv/weakspot/apps/api && BACKUP_DIR=/srv/weakspot-backups/postgres BACKUP_RETENTION_DAYS=7 ./deploy/backup_local_postgres.sh >>/var/log/weakspot-postgres-backup.log 2>&1
```

Run the first backup immediately:

```bash
sudo env BACKUP_DIR=/srv/weakspot-backups/postgres BACKUP_RETENTION_DAYS=7 \
  ./deploy/backup_local_postgres.sh
```

Perform a restore drill using an explicitly named disposable database:

```bash
latest_backup="$(find /srv/weakspot-backups/postgres -type f -name 'weakspot-*.dump' -print | sort | tail -n 1)"
test -n "$latest_backup"
docker compose exec -T postgres sh -eu -c \
  'dropdb --if-exists --username "$POSTGRES_USER" weakspot_restore_test && createdb --username "$POSTGRES_USER" weakspot_restore_test'
docker compose exec -T postgres sh -eu -c \
  'exec pg_restore --username "$POSTGRES_USER" --dbname weakspot_restore_test --no-owner --no-acl --exit-on-error' \
  <"$latest_backup"
docker compose exec -T postgres sh -eu -c \
  'psql --username "$POSTGRES_USER" --dbname weakspot_restore_test --tuples-only --command "SELECT version_num FROM alembic_version"'
docker compose exec -T postgres sh -eu -c \
  'exec dropdb --username "$POSTGRES_USER" weakspot_restore_test'
```

Local backups protect against accidental data changes, but not loss of the
entire server or its disk. Moving a copy off the server is the next reliability
upgrade when the data becomes harder to replace.

## 6. Seven-day observation and rollback

Keep the old RDS instance, final snapshot, CA bundle, and protected pre-cutover
deployment for seven days. Monitor API readiness, PostgreSQL container restarts,
free disk space, backup log freshness, and user-facing database errors.

If no local writes have been accepted, rollback by restoring the protected old
deployment and RDS `.env`, starting it, and verifying readiness before removing
maintenance mode. Once local writes exist, never point the API directly back
at the stale RDS database: stop writes and migrate the complete local database
back to RDS, or fix forward.

After seven healthy days, run another backup and restore drill. Then disable
RDS deletion protection, delete the CloudFormation/RDS resources, and remove
retained RDS snapshots only after explicitly confirming that AWS recovery is
no longer required. Snapshot deletion is separate from instance deletion and
is irreversible.
