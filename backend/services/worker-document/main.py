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
from tools import process_pdf

logger.add("worker.log", rotation="10 MB", retention="10 days", level="INFO")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
QUEUE_NAME = os.getenv("QUEUE_NAME", "documentQueue")
INPUT_PATH = Path("tmp/input")
OUTPUT_PATH =Path("tmp/output")

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

async def process_document(job, job_token):
    """
    Función procesadora con logs detallados.
    """
    with logger.contextualize(job_id=job.id):
        try:
            payload = job.data
            
            match payload['mime_type']:
                case "application/pdf":
                    return await process_pdf(s3, INPUT_PATH, OUTPUT_PATH, payload)
                case _:  
                    return "e"
         
        except Exception as e:
            # .exception() guarda el stack trace completo automáticamente
            logger.exception(f"Fallo crítico en el trabajo {job.id}: {e}")
            raise e

async def main():
    # Define Redis connection settings (Host/Port for the local container)
    connection_config = {"connection": {"host": REDIS_HOST, "port": REDIS_PORT }}
    
    # Initialize the Worker for the 'documentQueue' queue
    worker = Worker(QUEUE_NAME, process_document, connection_config)

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