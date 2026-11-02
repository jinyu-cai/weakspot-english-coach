"""Offline test for the atomic production environment switch helper."""

from pathlib import Path
import stat
import tempfile

from deploy.configure_local_postgres import configure


def main() -> None:
    with tempfile.TemporaryDirectory() as directory:
        env_path = Path(directory) / ".env"
        original = (
            "APP_ENV=production\n"
            "MODEL_KEY=preserved\n"
            "DATABASE_URL=postgresql+psycopg://app:old@rds.example.com/weakspot"
            "?sslmode=verify-full\n"
        )
        env_path.write_text(original, encoding="utf-8")
        backup = configure(
            env_path,
            password="b" * 64,
            timestamp="20260904T000000Z",
        )
        configured = env_path.read_text(encoding="utf-8")
        assert backup.read_text(encoding="utf-8") == original
        assert stat.S_IMODE(backup.stat().st_mode) == 0o600
        assert stat.S_IMODE(env_path.stat().st_mode) == 0o600
        assert "MODEL_KEY=preserved" in configured
        assert "POSTGRES_DB=weakspot" in configured
        assert "POSTGRES_USER=weakspot_app" in configured
        assert f"POSTGRES_PASSWORD={'b' * 64}" in configured
        assert f"weakspot_app:{'b' * 64}@postgres:5432/weakspot" in configured
        assert "rds.example.com" not in configured
        try:
            configure(env_path, password="c" * 64)
        except ValueError as exc:
            assert "refusing to rotate" in str(exc)
        else:
            raise AssertionError("A repeated local password rotation was accepted.")
    print("Local PostgreSQL environment switch tests passed.")


if __name__ == "__main__":
    main()
