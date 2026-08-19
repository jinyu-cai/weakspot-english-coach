"""Delete PostgreSQL rows whose application TTL has elapsed."""

from app.db.repositories import cleanup_expired_records


def main() -> None:
    counts = cleanup_expired_records()
    print("Expired-row cleanup:", ", ".join(f"{name}={count}" for name, count in sorted(counts.items())))


if __name__ == "__main__":
    main()
