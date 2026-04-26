import logging
from botocore.config import Config
import os
import asyncpg

S3_CONFIG = Config(
    signature_version="s3v4",
    s3={"addressing_style": "path"},
)

async def download(s3_session, s3_bucket, storage_path):
    async with s3_session.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT"),
        aws_access_key_id=os.environ.get("S3_ACCESS_KEY"),
        aws_secret_access_key=os.environ.get("S3_SECRET_KEY"),
        region_name=os.environ.get("S3_REGION"),
        config=S3_CONFIG,
    ) as s3:
        obj = await s3.get_object(Bucket=s3_bucket, Key=storage_path)
        
        logging.info("YAA")
        async with obj["Body"] as stream:
            data = await stream.read()
            return data
    
async def process_pdf(pool, s3_session, s3_bucket, payload):     
    data = payload['data']
    storage_path = data['storage_path']
    
    file = await download(s3_session, s3_bucket, storage_path)

    logging.info(f"Tamaño del archivo: {len(file)} bytes")
    logging.info(f"Encabezado: {file[:5]}")    