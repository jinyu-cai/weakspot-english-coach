"""Create the DynamoDB single table (idempotent).

Run from the apps/api directory (so `app` is importable):

    python -m scripts.create_table

Uses AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / DYNAMODB_TABLE
from .env (or the ambient environment / IAM role).
"""

import boto3
from botocore.exceptions import ClientError

from app.config import settings


def ensure_ttl(client, name: str) -> None:
    """Enable asynchronous cleanup for expired memory and rate-limit rows."""
    try:
        description = client.describe_time_to_live(TableName=name)
        ttl = description.get("TimeToLiveDescription", {})
        status = ttl.get("TimeToLiveStatus")
        if status in {"ENABLED", "ENABLING"} and ttl.get("AttributeName") == "ttl":
            print(f"TTL is {status.lower()} on '{name}' (attribute: ttl).")
            return
        if status in {"DISABLING", "ENABLING"}:
            print(f"TTL is currently {status.lower()} on '{name}'; retry later if needed.")
            return
        client.update_time_to_live(
            TableName=name,
            TimeToLiveSpecification={"Enabled": True, "AttributeName": "ttl"},
        )
        print(f"TTL enablement requested on '{name}' (attribute: ttl).")
    except ClientError as error:
        # Some local DynamoDB emulators do not implement TTL. The application
        # still applies expiresAt synchronously during every retrieval.
        print(f"TTL could not be enabled automatically: {error}")


def create_table() -> None:
    client = boto3.client(
        "dynamodb",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
        endpoint_url=settings.dynamodb_endpoint_url or None,
    )
    name = settings.dynamodb_table

    try:
        client.describe_table(TableName=name)
        print(f"Table '{name}' already exists.")
        ensure_ttl(client, name)
        return
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            raise

    print(f"Creating table '{name}' (PAY_PER_REQUEST, PK+SK string keys) ...")
    client.create_table(
        TableName=name,
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
    )
    client.get_waiter("table_exists").wait(TableName=name)
    print(f"Table '{name}' is ready.")
    ensure_ttl(client, name)


if __name__ == "__main__":
    create_table()
