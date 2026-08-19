"""Fail deployment if the production database URL weakens RDS TLS."""

from sqlalchemy.engine import make_url

from app.config import settings


def main() -> int:
    url = make_url(settings.database_url)
    if url.drivername != "postgresql+psycopg":
        raise SystemExit("DATABASE_URL must use postgresql+psycopg.")
    if url.host in {None, "127.0.0.1", "localhost", "::1"}:
        raise SystemExit("Production DATABASE_URL must use the RDS endpoint hostname.")
    if url.query.get("sslmode") != "verify-full":
        raise SystemExit("Production DATABASE_URL must set sslmode=verify-full.")
    if url.query.get("sslrootcert") != "/run/secrets/rds-ca-bundle.pem":
        raise SystemExit(
            "Production DATABASE_URL must use /run/secrets/rds-ca-bundle.pem."
        )
    print("Production PostgreSQL URL requires verified RDS TLS.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
