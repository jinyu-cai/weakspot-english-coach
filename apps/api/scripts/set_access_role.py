"""Grant or revoke owner/member access roles in DynamoDB.

Examples:
    uv run python -m scripts.set_access_role member@example.com member
    uv run python -m scripts.set_access_role github-login owner
    uv run python -m scripts.set_access_role member@example.com revoke
"""

import argparse

from app.db.repositories import delete_access_role, get_access_role, set_access_role


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage owner/member access roles.")
    parser.add_argument("identifier", help="Google email or GitHub login, case-insensitive")
    parser.add_argument("role", choices=["owner", "member", "revoke"])
    args = parser.parse_args()

    if args.role == "revoke":
        existing = get_access_role(args.identifier)
        delete_access_role(args.identifier)
        print(f"revoked {existing['identifier'] if existing else args.identifier}")
        return 0

    role = set_access_role(args.identifier, args.role, updated_by="script")
    print(f"{role['identifier']} -> {role['role']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
