from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
import os
import signal
import asyncio
import boto3
from loguru import logger
from bullmq import Worker
from botocore.client import Config
from mypy_boto3_s3 import S3Client
from tools import process_pdf
import asyncpg

logger.add("worker.log", rotation="10 MB", retention="10 days", level="INFO")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
QUEUE_NAME = os.getenv("QUEUE_NAME", "documentQueue")
DATABASE_URL = os.getenv("DATABASE_URL", "localhost")
BUCKET = os.getenv("S3_BUCKET", "documents")

INPUT_PATH = Path("tmp/input")
OUTPUT_PATH =Path("tmp/output")

def make_processor(pool: asyncpg.Pool, s3: S3Client):
    async def process_document(job, job_token):
        """
        Processor function with detailed logging.
        """
        with logger.contextualize(job_id=job.id):
            try:
                payload = job.data
                
                logger.success(payload['storage_path'])
                
                match payload['mime_type']:
                    case "application/pdf":
                        return await process_pdf(pool, s3, BUCKET, INPUT_PATH, OUTPUT_PATH, payload)
                    case _:  
                        logger.warning(f"Unsupported MIME type: {payload['mime_type']}")
                        raise ValueError(f"Unsupported MIME type: {payload['mime_type']}")
            
            except Exception as e:
                logger.exception(f"Critical failure in job {job.id}: {e}")
                raise  # ← preserves the original traceback
            
    return process_document

async def main():
    # Define Redis connection settings (Host/Port for the local container)
    connection_config = {"connection": {"host": REDIS_HOST, "port": REDIS_PORT }}
    
    # postgreSQL pool
    pool = await asyncpg.create_pool(
        dsn=DATABASE_URL,
        min_size=5,  # Minimum number of open connections
        max_size=20, # Maximum number of concurrent connections
        command_timeout=60
    )
    
    s3 = boto3.client(
        's3',
        endpoint_url=os.environ['AWS_ENDPOINT'],
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        region_name=os.environ['AWS_REGION'],
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        )
    )    
    
    # Initialize the Worker for the 'documentQueue' queue
    worker = Worker(QUEUE_NAME, make_processor(pool, s3), connection_config)

    logger.info("Worker started. Waiting for new documents...")
    
    # Create an event to manage the graceful shutdown process
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    def handle_exit():
        # Triggered when a termination signal is received
        logger.warning("Shutdown signal received (SIGINT/SIGTERM)")
        stop_event.set()

    # Register signal handlers for clean exit on Ctrl+C or Docker stop
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, handle_exit)

    try:
        # Keep the script alive while the worker processes jobs in the background
        await stop_event.wait()
    except Exception as e:
        logger.error(f"Unexpected error in the main loop: {e}")
    finally:
        logger.info("Starting resource cleanup...")
        try:
            await worker.close()
            logger.info("Worker stopped successfully.")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        # Silently handle Ctrl+C at the top level
        pass