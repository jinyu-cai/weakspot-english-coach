# PostgreSQL Beginner Guide

The current database is a good fit for someone who already knows basic SQL.
It uses normal tables, primary/foreign keys, indexes, transactions, and keyset
pagination. The only less-basic feature is `JSONB`, which keeps flexible AI
response fields without turning every nested field into a column.

## Mental model

```text
FastAPI route
  -> service applies learning rules
  -> repository opens a short SQLAlchemy transaction
  -> typed PostgreSQL columns support keys, filters, ordering, and constraints
  -> JSONB payload preserves the complete API-shaped object
```

For example, a memory has normal columns such as `user_id`, `memory_id`,
`kind`, `status`, `created_at`, and `expires_at`. Its explanations, evidence,
verification history, and other evolving fields stay in `payload JSONB`.

This hybrid design is intentional:

- typed columns make common SQL queries and indexes easy to understand;
- foreign keys protect ownership and cascade deletion;
- JSONB prevents an AI response change from requiring dozens of small schema
  migrations;
- repository functions return the existing Python dictionaries, so route and
  service contracts remain stable.

## Files to read in order

1. [`schema.py`](../apps/api/app/db/schema.py) — tables, columns, constraints,
   and indexes.
2. [`database.py`](../apps/api/app/db/database.py) — engine, connection pool,
   commit, and rollback behavior.
3. [`postgres_repositories.py`](../apps/api/app/db/postgres_repositories.py) —
   SQL queries and transactional business persistence.
4. [`alembic/env.py`](../apps/api/alembic/env.py) and
   [`versions/20260817_0001_postgresql.py`](../apps/api/alembic/versions/20260817_0001_postgresql.py)
   — schema migration entry points.
5. [`pagination.py`](../apps/api/app/core/pagination.py) — signed, identity-bound
   keyset cursor encoding.

`repositories.py` is only the stable import surface. New database code belongs
in `postgres_repositories.py` until it is split into smaller domain modules.

## Start locally

From `apps/api`:

```bash
uv sync
docker compose -f docker-compose.local.yml up -d postgres
uv run alembic upgrade head
uv run python -m scripts.dev_server
```

The Compose service creates:

- `weakspot` for local development;
- `weakspot_test` for destructive integration-test resets.

The test helper refuses to reset a non-local host or a database whose name does
not end in `_test`.

To stop the server but keep your development data:

```bash
docker compose -f docker-compose.local.yml stop postgres
```

Do not add `-v` unless you intentionally want Docker to delete the local
PostgreSQL volume.

## First SQL exercises

Open `psql` inside the container:

```bash
docker compose -f docker-compose.local.yml exec postgres \
  psql -U weakspot -d weakspot
```

Then try these read-only queries:

```sql
-- See every application table.
\dt

-- Inspect the relational columns for memories.
\d memories

-- Count memories by lifecycle state.
SELECT status, count(*)
FROM memories
GROUP BY status
ORDER BY status;

-- Read one flexible JSON field.
SELECT memory_id, payload ->> 'content' AS content
FROM memories
WHERE user_id = 'demo-user-001'
ORDER BY updated_at DESC
LIMIT 10;

-- See which indexes PostgreSQL can use for chat history.
\d chat_sessions
```

Exit with `\q`.

## Important patterns in this project

### Upsert

Many save functions use PostgreSQL `INSERT ... ON CONFLICT`. A stable primary
key makes a retry update the same logical row instead of creating a duplicate.

### Row lock

Claims and learning-state updates use `SELECT ... FOR UPDATE`. Competing
transactions serialize on the same row, which prevents lost updates and fences
stale workers.

### One transaction for related effects

A practice result can update the attempt, error evidence, mastery, profile,
memory, and request marker together. If any statement fails, `session_scope()`
rolls the transaction back.

### Keyset pagination

Chat and Input Learning lists order by `(created_at, id)`. The next cursor holds
the last pair, bound to the learner and entity type. This remains stable and
efficient as history grows; it does not use a large `OFFSET`.

### Logical expiry plus physical cleanup

The application filters expired memories immediately. The hourly
`scripts.cleanup_expired` job later removes eligible records physically. User
behavior never waits for the cleanup job.

## Schema changes

Do not edit a production database by hand. Change `schema.py`, generate or
write a new Alembic revision, inspect it, test it against `weakspot_test`, and
then deploy it before the new application code:

```bash
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
uv run alembic current
```

For a destructive change, add an explicit data migration and rollback plan.
Never edit the already-applied initial revision after it has reached a shared
environment.

## Test progression

```bash
# No database connection: imports, schemas, provider contracts.
uv run python -m scripts.smoke_test

# Real PostgreSQL semantics: constraints, locks, transactions, JSONB, cursors.
uv run python -m scripts.integration_test
uv run python -m scripts.storage_contract_test
uv run python -m scripts.stealth_input_test
```

For production provisioning, TLS, migration, backup, and rollback, use the
[Amazon RDS PostgreSQL runbook](AWS_RDS_POSTGRESQL_DEPLOYMENT.md).
