"""Create the DynamoDB single table (idempotent).

Run from the backend/ directory (so `app` is importable):

    python -m scripts.create_table

Uses AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / DYNAMODB_TABLE
from .env (or the ambient environment / IAM role).
"""

import boto3
from botocore.exceptions import ClientError

from app.config import settings


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
        print(f"Table '{name}' already exists — nothing to do.")
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


if __name__ == "__main__":
    create_table()
