# Backend deployment (Linux + Docker + Nginx + HTTPS)

Production runs FastAPI and PostgreSQL 16 together on the Oracle Linux server.
Nginx exposes only the API on HTTPS; PostgreSQL stays on the private Docker
Compose network and persists in the `weakspot-postgres-data` volume.

For the one-time RDS migration, backup setup, restore drill, seven-day rollback
window, and RDS retirement, follow the
[server-local PostgreSQL runbook](../../docs/LOCAL_POSTGRESQL_PRODUCTION.md).

## Prerequisites

Install Docker with the Compose plugin, Nginx, and Certbot. Point the public API
DNS record at the server. Ensure Docker starts after a reboot.

```bash
sudo systemctl enable --now docker
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

## Configure production

Copy the production template and preserve it with mode `0600`:

```bash
cd /srv/weakspot/apps/api
cp deploy/.env.production.example .env
chmod 0600 .env
openssl rand -hex 32
```

Set the same generated 64-character database password in
`POSTGRES_PASSWORD` and the password portion of `DATABASE_URL`. Fill the model,
OAuth, session, CORS, and frontend values. Keep `APP_ENV=production` and do not
enable `USE_FAKE_AI`.

The production database values have this shape:

```dotenv
POSTGRES_DB=weakspot
POSTGRES_USER=weakspot_app
POSTGRES_PASSWORD=<64-character-hex-secret>
DATABASE_URL=postgresql+psycopg://weakspot_app:<same-secret>@postgres:5432/weakspot
```

Do not add a PostgreSQL `ports` mapping. The checked-in Compose file exposes
only `127.0.0.1:8000` for Nginx.

## Start or update the backend

```bash
./deploy/start_backend.sh
curl --fail http://127.0.0.1:8000/api/v1/health/ready
```

The launcher validates Compose and database settings, builds the API image,
waits for PostgreSQL, applies Alembic migrations, starts the API, and waits for
database readiness.

For later releases:

```bash
git pull
./deploy/start_backend.sh
```

Never update production with `docker compose down -v`; `-v` deletes the named
database volume.

## Nginx and HTTPS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/weakspot-api
sudo nano /etc/nginx/sites-available/weakspot-api
sudo ln -s /etc/nginx/sites-available/weakspot-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.your-domain.com
```

The frontend's `NEXT_PUBLIC_API_BASE_URL` must use this HTTPS hostname, and the
frontend origin must appear exactly in backend `CORS_ORIGINS`.

## Required scheduled jobs

Run logical expiry cleanup hourly and a verified local dump daily:

```cron
17 * * * * cd /srv/weakspot/apps/api && docker compose exec -T api python -m scripts.cleanup_expired
30 3 * * * cd /srv/weakspot/apps/api && BACKUP_DIR=/srv/weakspot-backups/postgres BACKUP_RETENTION_DAYS=7 ./deploy/backup_local_postgres.sh >>/var/log/weakspot-postgres-backup.log 2>&1
```

Inspect backup freshness and free disk space every day. These backups are on
the same server and therefore do not protect against loss of the whole server
or disk.

## Verification and operations

After each deployment, verify public readiness and exercise login, Diagnose,
History, Chat, Memory, Plan, and one Practice submission.

```bash
curl --fail https://api.your-domain.com/api/v1/health
curl --fail https://api.your-domain.com/api/v1/health/ready
docker compose ps
docker compose logs --tail=200 api postgres
```

`/api/v1/health` is liveness. `/api/v1/health/ready` executes `SELECT 1` and
returns HTTP 503 when PostgreSQL is unavailable.
