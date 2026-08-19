"""Create or rotate the least-privilege PostgreSQL application login.

Required environment variables:

* ``DATABASE_APP_PASSWORD``: password to set for the application role

Prefer ``RDS_ADMIN_HOST`` plus a hidden-prompt ``RDS_ADMIN_PASSWORD``. A
temporary ``RDS_ADMIN_DATABASE_URL`` is also accepted for automation.

The master URL is never written to disk or printed. Remove it from the shell
after this command finishes; normal API processes use ``DATABASE_URL`` only.
"""

from __future__ import annotations

import os

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url


def main() -> int:
    raw_url = os.environ.get("RDS_ADMIN_DATABASE_URL", "").strip()
    app_password = os.environ.get("DATABASE_APP_PASSWORD", "")
    app_user = os.environ.get("DATABASE_APP_USER", "weakspot_app").strip()
    if not app_password:
        raise SystemExit(
            "Set DATABASE_APP_PASSWORD before running."
        )
    if not app_user or len(app_user) > 63:
        raise SystemExit("DATABASE_APP_USER must contain 1-63 characters.")

    if raw_url:
        url = make_url(raw_url)
        database_name = url.database or "weakspot"
        connection_options = {
            "host": url.host,
            "port": url.port or 5432,
            "dbname": database_name,
            "user": url.username,
            "password": url.password,
            **dict(url.query),
        }
    else:
        host = os.environ.get("RDS_ADMIN_HOST", "").strip()
        admin_password = os.environ.get("RDS_ADMIN_PASSWORD", "")
        if not host or not admin_password:
            raise SystemExit(
                "Set RDS_ADMIN_HOST, RDS_ADMIN_PASSWORD, and DATABASE_APP_PASSWORD."
            )
        database_name = os.environ.get("RDS_DATABASE_NAME", "weakspot").strip()
        connection_options = {
            "host": host,
            "port": int(os.environ.get("RDS_ADMIN_PORT", "5432")),
            "dbname": database_name,
            "user": os.environ.get("RDS_ADMIN_USER", "weakspot_admin"),
            "password": admin_password,
            "sslmode": "verify-full",
            "sslrootcert": os.environ.get("RDS_ADMIN_SSLROOTCERT", ""),
        }
        if not connection_options["sslrootcert"]:
            raise SystemExit("Set RDS_ADMIN_SSLROOTCERT to the downloaded RDS CA bundle.")
    with psycopg.connect(**connection_options) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (app_user,))
            if cursor.fetchone():
                cursor.execute(
                    sql.SQL("ALTER ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %s").format(
                        sql.Identifier(app_user)
                    ),
                    (app_password,),
                )
            else:
                cursor.execute(
                    sql.SQL("CREATE ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %s").format(
                        sql.Identifier(app_user)
                    ),
                    (app_password,),
                )
            cursor.execute(
                sql.SQL("ALTER DATABASE {} OWNER TO {}").format(
                    sql.Identifier(database_name), sql.Identifier(app_user)
                )
            )
            cursor.execute(
                sql.SQL("GRANT USAGE, CREATE ON SCHEMA public TO {}").format(
                    sql.Identifier(app_user)
                )
            )
    print(f"PostgreSQL application role '{app_user}' is ready for database '{database_name}'.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
