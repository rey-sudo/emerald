import logging
import boto3
import asyncio
from botocore.client import Config

class S3Service:
    """
    Async wrapper around a synchronous boto3 S3 client.
    Instantiate once at startup and store in app.state.s3.
    """

    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str) -> None:
        self.bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
        )

    async def put(self, key: str, body: bytes, content_type: str, metadata: dict) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
                Metadata=metadata,
            ),
        )

    async def delete(self, key: str) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.delete_object(Bucket=self.bucket, Key=key),
        )

    async def compensate(self, key: str, logger: logging.Logger) -> None:
        """
        Best-effort delete used as compensating action.
        Swallows exceptions — the caller is already handling one.
        Orphaned objects are reconciled by the storage cleanup job.
        """
        try:
            await self.delete(key)
            logger.info(f"[S3Service] Compensating DELETE succeeded: {key}")
        except Exception as e:
            logger.error(f"[S3Service] Compensating DELETE failed for '{key}': {e}")
