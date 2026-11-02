"""Offline contract tests for the production PostgreSQL URL guard."""

from scripts.check_production_database import validate_local_production_database


SECRET = "a" * 64
VALID_URL = f"postgresql+psycopg://weakspot_app:{SECRET}@postgres:5432/weakspot"


def _expect_rejected(url: str, **overrides: str) -> None:
    values = {
        "postgres_db": "weakspot",
        "postgres_user": "weakspot_app",
        "postgres_password": SECRET,
        **overrides,
    }
    try:
        validate_local_production_database(url, **values)
    except ValueError:
        return
    raise AssertionError(f"Unsafe database configuration was accepted: {url}")


def main() -> None:
    validate_local_production_database(
        VALID_URL,
        postgres_db="weakspot",
        postgres_user="weakspot_app",
        postgres_password=SECRET,
    )
    _expect_rejected(VALID_URL.replace("@postgres:", "@127.0.0.1:"))
    _expect_rejected(VALID_URL.replace("@postgres:", "@db.example.com:"))
    _expect_rejected(VALID_URL.replace("postgresql+psycopg", "sqlite"))
    _expect_rejected(VALID_URL, postgres_user="postgres")
    _expect_rejected(VALID_URL, postgres_password="short")
    _expect_rejected(VALID_URL.replace("/weakspot", "/other"))
    _expect_rejected(VALID_URL + "?sslmode=verify-full")
    _expect_rejected(
        VALID_URL + "?sslrootcert=/run/secrets/rds-ca-bundle.pem"
    )
    print("Local PostgreSQL deployment guard tests passed.")


if __name__ == "__main__":
    main()
