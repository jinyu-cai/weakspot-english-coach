"""DynamoDB (boto3 resource) does not accept Python floats and returns numbers
as Decimal. These helpers convert in both directions so the rest of the app can
work with plain int/float and JSON-serializable values.
"""

from decimal import Decimal


def to_dynamo(value):
    """Recursively convert floats to Decimal for DynamoDB writes."""
    if isinstance(value, bool):
        return value
    if isinstance(value, float):
        # via str() to avoid binary float imprecision in Decimal
        return Decimal(str(value))
    if isinstance(value, list):
        return [to_dynamo(v) for v in value]
    if isinstance(value, dict):
        return {k: to_dynamo(v) for k, v in value.items()}
    return value


def clean(value):
    """Recursively convert DynamoDB Decimals back to int/float for JSON output."""
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    return value
