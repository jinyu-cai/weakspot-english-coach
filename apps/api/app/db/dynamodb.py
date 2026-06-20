import boto3

from app.config import settings

dynamodb = boto3.resource(
    "dynamodb",
    region_name=settings.aws_region,
    aws_access_key_id=settings.aws_access_key_id or None,
    aws_secret_access_key=settings.aws_secret_access_key or None,
    endpoint_url=settings.dynamodb_endpoint_url or None,
)

table = dynamodb.Table(settings.dynamodb_table)
