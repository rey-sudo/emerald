from dotenv import load_dotenv
load_dotenv()
import asyncio
import json
from time import sleep
import time
import uuid
import logging
from functools import partial
from tools import process_pdf

import pulsar
import asyncpg
import aioboto3

# -----------------------
# CONFIG
# -----------------------

PULSAR_URL = "pulsar://broker:6650"
TOPIC = "persistent://public/default/document-api.document"

EVENT_TYPE = "document.created"

SUBSCRIPTION = "document-processor"
POSTGRES_DSN = "postgres://postgres:password@postgres_global:5432/document_processor"
S3_BUCKET = "documents"

CONCURRENCY = 100        # 🔥 alto porque es I/O-bound
QUEUE_SIZE = 1000        # buffer interno

logging.basicConfig(level=logging.INFO)

# -----------------------
# GLOBALS
# -----------------------

queue = asyncio.Queue(maxsize=QUEUE_SIZE)
semaphore = asyncio.Semaphore(CONCURRENCY)

# -----------------------
# DB (asyncpg)
# -----------------------

async def already_processed(pool, event_id):
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "SELECT 1 FROM processed_events WHERE event_id=$1",
            event_id
        )

async def insert_processed(pool, event_id, timestamp_ms):
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO processed_events(event_id, created_at) VALUES($1,$2)",
            event_id,
            timestamp_ms
        )

async def insert_outbox(pool, document_id, timestamp_ms):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO events (
            specversion, event_type, source, id, time,
            entity_type, entity_id, data, metadata)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            """,
            0,
            "document.processed",
            "document-processor-worker",
            str(uuid.uuid4()),
            timestamp_ms,
            "document",
            document_id,
            json.dumps({"document_id": document_id}),
            json.dumps({}),
        )

# -----------------------
# S3 (aioboto3)
# -----------------------

async def upload(session, document_id, data):
    key = f"processed/{document_id}"

    async with session.client("s3") as s3:
        try:
            await s3.head_object(Bucket=S3_BUCKET, Key=key)
            logging.info(f"[SKIP S3] {key}")
            return
        except:
            pass

        await s3.put_object(Bucket=S3_BUCKET, Key=key, Body=data)

# -----------------------
# CORE HANDLER
# -----------------------

async def handle(msg, consumer, pool, s3_session):
    async with semaphore:
        try:
            payload = json.loads(msg.data())
            data = payload.get("data") or {}
            
            event_id = payload.get("event_id")
            event_type = payload.get("event_type")
            document_id = data.get("id")
            mime_type = data.get("mime_type")
            
            timestamp_ms = int(time.time() * 1000)
            
            # 1. Basic check
            if not event_id or not document_id:
                logging.warning("Invalid payload, acking")
                consumer.acknowledge(msg)
                return
                        
            # 2. Check event type ------------
            if event_type != EVENT_TYPE:
                consumer.acknowledge(msg)
                return
            
            # 3. Check event idempotence --------------
            if await already_processed(pool, event_id):
                consumer.acknowledge(msg)
                return
            
            # 4. Immediate ACK -------------------------------------
            try:
                await insert_processed(pool, event_id, timestamp_ms)
            except Exception:
                consumer.negative_acknowledge(msg)
                return
            
            consumer.acknowledge(msg)
            logging.info(f"[START] event={event_id} doc={document_id}")
            
            # 5. Process file ----------------------------------------------------
            for acc in range(3):
                try:
                    if mime_type == "application/pdf":
                        await process_pdf(pool, s3_session, S3_BUCKET, payload)
                    break
                except Exception:
                    if acc == 2:
                        raise
                    await asyncio.sleep(2 ** acc)

            # 6. Insert document.processed event
            for acc in range(3):
                try:
                    await insert_outbox(pool, document_id, timestamp_ms)
                    break
                except Exception:
                    if acc == 2:
                        raise
                    await asyncio.sleep(2 ** acc)

        except Exception:
            logging.exception("Error")


def pulsar_listener(loop, consumer):
    while True:
        msg = consumer.receive()
        asyncio.run_coroutine_threadsafe(queue.put(msg), loop)

async def worker_loop(consumer, pool, session):
    while True:
        msg = await queue.get()
        asyncio.create_task(handle(msg, consumer, pool, session))

async def main():
    pool = await asyncpg.create_pool(dsn=POSTGRES_DSN, min_size=5, max_size=20)

    s3_session = aioboto3.Session()

    pulsar_client = pulsar.Client(PULSAR_URL)
    consumer = pulsar_client.subscribe(
        TOPIC,
        subscription_name=SUBSCRIPTION,
        consumer_type=pulsar.ConsumerType.Shared,
        receiver_queue_size=500,
    )

    loop = asyncio.get_running_loop()

    import threading
    threading.Thread(
        target=pulsar_listener,
        args=(loop, consumer),
        daemon=True
    ).start()

    workers = [
        asyncio.create_task(worker_loop(consumer, pool, s3_session))
        for _ in range(10)
    ]

    await asyncio.gather(*workers)


if __name__ == "__main__":
    asyncio.run(main())