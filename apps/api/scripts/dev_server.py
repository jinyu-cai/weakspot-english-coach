"""Run the local API with Docker PostgreSQL and fake AI.

Start the database first:

    docker compose -f docker-compose.local.yml up -d postgres
    uv run python -m scripts.dev_server
"""

import os


def main() -> None:
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql+psycopg://weakspot:weakspot@127.0.0.1:5432/weakspot",
    )
    os.environ.setdefault("USE_FAKE_AI", "true")
    os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

    from scripts.create_table import create_table

    create_table()

    import uvicorn

    print("\n  Live dev backend  ->  http://localhost:8000")
    print("  Mode: local PostgreSQL + fake AI — no provider key needed")
    print("  CORS allows: http://localhost:3000\n")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False, log_level="info")


if __name__ == "__main__":
    main()
