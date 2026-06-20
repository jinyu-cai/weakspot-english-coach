"""Run a LIVE backend on http://localhost:8000 backed by in-process moto + fake AI.

No Docker, no AWS, no DeepSeek key — ideal for local front + back integration:
point the frontend's NEXT_PUBLIC_API_BASE_URL at http://localhost:8000.

    uv run python -m scripts.dev_server

Data is in-memory and resets when you stop the server. To run a live server
against a REAL database/AI instead, just use uvicorn directly with a real .env:
    uv run uvicorn app.main:app --reload --port 8000
"""

import os


def main() -> None:
    os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
    os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
    os.environ.setdefault("AWS_REGION", "us-east-1")
    os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
    os.environ.setdefault("USE_FAKE_AI", "true")
    os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

    import moto

    mock = moto.mock_aws()
    mock.start()
    try:
        from scripts.create_table import create_table

        create_table()

        import uvicorn

        print("\n  Live dev backend  ->  http://localhost:8000")
        print("  Mode: in-process moto (mock AWS) + fake AI — no keys needed")
        print("  CORS allows: http://localhost:3000")
        print("  Frontend:  NEXT_PUBLIC_API_BASE_URL=http://localhost:8000\n")

        # reload=False is REQUIRED: reload spawns a subprocess where moto is not active.
        uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False, log_level="info")
    finally:
        mock.stop()


if __name__ == "__main__":
    main()
