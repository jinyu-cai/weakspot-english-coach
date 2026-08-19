# Amazon RDS PostgreSQL Deployment

This is the active production runbook. The backend runs only on the Oracle San
Jose server; Alibaba ECS is no longer a backend origin. Qwen Model Studio can
still be configured as an external model, embedding, or speech provider from
Oracle.

## Chosen production shape

| Setting | Value | Reason |
| --- | --- | --- |
| Region | `us-west-1` (N. California) | Close to the Oracle San Jose backend |
| Engine | RDS PostgreSQL 16 | Familiar SQL with managed backups and patching |
| Instance | `db.t4g.micro`, Single-AZ | Lowest practical starting cost for this workload |
| Storage | 20 GiB gp3, autoscale to 100 GiB | Small initial bill with a bounded growth ceiling |
| Network | Public endpoint, port 5432 allowed only from Oracle's static `/32` | Supports the cross-cloud backend without opening general Internet access |
| Transport | `sslmode=verify-full` plus the AWS RDS CA bundle | Encrypts traffic and verifies the RDS hostname |
| Recovery | 7-day automated backups, encrypted storage, final snapshots, deletion protection | Reasonable protection for a small production service |

This is a cost-first configuration, not a high-availability configuration.
Single-AZ can be unavailable during a host or Availability Zone failure. Move
to Multi-AZ before the product has an uptime requirement that justifies the
additional instance cost. T4g is burstable; sustained CPU above its baseline
can incur CPU-credit charges. Use the
[AWS RDS PostgreSQL pricing page](https://aws.amazon.com/rds/postgresql/pricing/)
and Pricing Calculator for the current `us-west-1` estimate instead of relying
on a hard-coded monthly number.

## 1. Prerequisites

- AWS CLI authenticated to the intended AWS account.
- A VPC in `us-west-1` with two public subnets in different Availability Zones.
  Their route tables must reach an Internet Gateway.
- A reserved/static public IPv4 address for the Oracle backend, written as one
  CIDR such as `203.0.113.10/32`.
- Docker and this repository on the Oracle server.
- A maintenance window in which the API can reject writes.

The database has a public DNS endpoint because the application is outside AWS.
AWS recommends allowing only trusted IPs on publicly accessible RDS instances;
the template creates exactly one inbound `/32` rule. See
[AWS public/private RDS access](https://docs.aws.amazon.com/AmazonRDS/latest/gettingstartedguide/security-public-private.html).

## 2. Create RDS with CloudFormation

From the repository root, substitute the four real values:

```bash
aws cloudformation deploy \
  --region us-west-1 \
  --stack-name weakspot-postgresql \
  --template-file apps/api/deploy/rds-postgresql.yml \
  --parameter-overrides \
    VpcId=vpc-REPLACE_ME \
    PublicSubnetA=subnet-REPLACE_ME \
    PublicSubnetB=subnet-REPLACE_ME \
    OracleBackendCidr=203.0.113.10/32 \
  --no-fail-on-empty-changeset
```

Read the endpoint and managed master-secret ARN:

```bash
aws cloudformation describe-stacks \
  --region us-west-1 \
  --stack-name weakspot-postgresql \
  --query 'Stacks[0].Outputs' \
  --output table
```

The template asks RDS to manage the master password in Secrets Manager; AWS
documents that integration and rotation behavior in
[Password management with RDS and Secrets Manager](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-secrets-manager.html).
Do not place the master URL in the normal application `.env`.

If `16.14` is not orderable in the account at deployment time, list the
available PostgreSQL 16 versions in `us-west-1`, then pass one as
`EngineVersion=16.x`. Keep the major version at 16 because the application and
parameter group are tested against it.

## 3. Install the RDS trust bundle on Oracle

```bash
cd apps/api
curl -fsSLo deploy/certs/global-bundle.pem \
  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
chmod 0644 deploy/certs/global-bundle.pem
```

AWS publishes `global-bundle.pem` for commercial Regions and explains
certificate rotation in its
[RDS TLS certificate guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html).
The production container mounts this file read-only. PostgreSQL's
`verify-full` mode verifies both the CA chain and endpoint hostname; see the
[RDS PostgreSQL SSL guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html).

## 4. Create the application login

Retrieve the managed master credential from Secrets Manager without copying it
into a file, then enter both passwords through hidden shell prompts:

```bash
cd apps/api
export RDS_ADMIN_HOST='RDS_ENDPOINT'
export RDS_ADMIN_USER=weakspot_admin
export RDS_DATABASE_NAME=weakspot
export RDS_ADMIN_SSLROOTCERT="$PWD/deploy/certs/global-bundle.pem"
read -s RDS_ADMIN_PASSWORD
export RDS_ADMIN_PASSWORD
export DATABASE_APP_USER=weakspot_app
read -s DATABASE_APP_PASSWORD
export DATABASE_APP_PASSWORD
UV_CACHE_DIR=.uv-cache uv run python -m scripts.bootstrap_rds_app_user
unset RDS_ADMIN_PASSWORD DATABASE_APP_PASSWORD
```

The command creates or rotates a non-superuser login and makes it owner of the
`weakspot` database so Alembic can manage the application schema. It never
prints either password. Store the application password in the Oracle server's
secret management process, not in Git.

## 5. Configure and initialize the backend

Copy `apps/api/deploy/.env.production.example` to `apps/api/.env`. Set the
application URL, URL-encoding the password:

```dotenv
DATABASE_URL=postgresql+psycopg://weakspot_app:ENCODED_APP_PASSWORD@RDS_ENDPOINT:5432/weakspot?sslmode=verify-full&sslrootcert=/run/secrets/rds-ca-bundle.pem
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=5
DATABASE_CONNECT_TIMEOUT_SECONDS=10
```

Apply the schema from Oracle:

```bash
cd apps/api
docker compose build
docker compose run --rm api alembic upgrade head
```

`GET /api/v1/health` remains a process/liveness check.
`GET /api/v1/health/ready` executes `SELECT 1` and must report `ready` before
traffic is restored.

## 6. Maintenance migration from DynamoDB

The importer is deliberately one-time and is the only runtime-adjacent code
that still needs `boto3`. It paginates the complete source table, excludes
expired TTL rows and transient claims, reconstructs only committed transcript
batches, and upserts stable PostgreSQL keys. It does not print learner content.

1. Enable the product maintenance page or otherwise reject writes.
2. Stop the API container and confirm no background workers are active.
3. Preserve the DynamoDB table and its backup/PITR state. Do not delete it.
4. On Oracle, install the isolated migration dependencies and configure
   read access to the source table.
5. Run dry-run, apply, then a separate verify pass:

```bash
cd apps/api
UV_CACHE_DIR=.uv-cache uv sync --group migration

export DYNAMODB_SOURCE_REGION=us-east-1
export DYNAMODB_SOURCE_TABLE=WeakSpotEnglishCoach
# Supply source AWS credentials through the existing secure server mechanism.

UV_CACHE_DIR=.uv-cache uv run python -m scripts.migrate_dynamodb_to_postgres --dry-run
UV_CACHE_DIR=.uv-cache uv run python -m scripts.migrate_dynamodb_to_postgres --apply
UV_CACHE_DIR=.uv-cache uv run python -m scripts.migrate_dynamodb_to_postgres --verify
```

`--apply` is idempotent. It records a migration audit only as `verified` after
the durable per-entity counts and canonical payload checksums match. Any
unmapped durable entity, count mismatch, or checksum mismatch exits nonzero.

After verification, start the new release:

```bash
./deploy/start_backend.sh
curl --fail https://enapi.jinxxx.de/api/v1/health/ready
```

Exercise login, Diagnose, History, Chat, Memory, Plan, and one practice submit
before removing maintenance mode. Keep the DynamoDB source read-only through
the rollback window.

## 7. Rollback

Before traffic returns, rollback is simple: stop the PostgreSQL release, switch
the Oracle deployment back to the previous application revision and its old
DynamoDB environment, verify health, then remove maintenance mode. Because no
writes occurred during the cutover, the source remains authoritative.

After PostgreSQL has accepted production writes, do not switch back casually:
that would discard newer data. Re-enable maintenance, export/restore the new
writes deliberately, or fix forward. Keep RDS snapshots and the untouched
DynamoDB table until the migration has been observed for the chosen retention
period.

## 8. Operations

Run logical expiry cleanup at least hourly from Oracle. For example, invoke the
already-running container from cron:

```cron
17 * * * * cd /srv/weakspot/apps/api && docker compose exec -T api python -m scripts.cleanup_expired
```

Create CloudWatch alarms for CPU utilization, free storage, database
connections, burst balance, read/write latency, and failed connections. Review
automated backups and test a snapshot restore. Storage autoscaling begins when
RDS observes sustained low free space and never shrinks automatically; the
template's 100 GiB maximum is a cost guardrail. See
[RDS storage autoscaling](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIOPS.Autoscaling.html).

Deletion protection is enabled, and CloudFormation retains a snapshot on
replacement/deletion. To intentionally remove the database, first take and
verify a manual snapshot, explicitly disable deletion protection, and then
update/delete the stack.

If the Oracle static IP changes, update `OracleBackendCidr` immediately. Never
broaden the security group to `0.0.0.0/0` as a workaround.

## When to reconsider Aurora

Stay on this RDS instance while traffic is small and steady. Re-evaluate Aurora
PostgreSQL when measured needs include Multi-AZ resilience, faster failover,
many read replicas, or serverless scaling that offsets Aurora's higher minimum
and I/O costs. The SQLAlchemy/PostgreSQL application layer is intentionally
portable, so that later move should be an infrastructure migration rather than
another repository rewrite.
