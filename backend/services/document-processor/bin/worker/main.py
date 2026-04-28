import asyncio
import json
import time
import hashlib
import logging
import signal
import threading
from typing import Any

import pulsar
import asyncpg
import aioboto3

from uuid6 import uuid7
from tools import process_pdf

# =============================================================================
# CONFIG
# =============================================================================

PULSAR_URL = "pulsar://broker:6650"
TOPIC = ["persistent://public/default/document.created"]
SUBSCRIPTION_NAME = "document-processor-worker-shared-group"

POSTGRES_DSN = "postgres://postgres:password@postgres_global:5432/document_processor"
S3_BUCKET = "documents"

CONCURRENCY = 40
QUEUE_SIZE = 500

logging.basicConfig(level=logging.INFO)

# =============================================================================
# GLOBALS
# =============================================================================

queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_SIZE)
semaphore = asyncio.Semaphore(CONCURRENCY)
shutdown_event = asyncio.Event()
_active_tasks: set[asyncio.Task] = set()

# =============================================================================
# HELPERS
# =============================================================================

def compute_checksum_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
# =============================================================================
# DB
# =============================================================================

async def try_insert_processed(pool, event_id, ts):
    async with pool.acquire() as conn:
        return await conn.fetchval(
            """
            INSERT INTO processed_events(event_id, created_at)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            RETURNING event_id
            """,
            event_id,
            ts
        ) is not None


async def insert_outbox(pool, document, ts, checksum, metadata):
    payload = {
        "id": document.get("id"),
        "status": "PROCESSED",
        "checksum": "hash123",
        "metadata": {},
        "v": document.get("v")
    }

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO events (
                specversion, event_type, source, id, time,
                entity_type, entity_id, data, metadata
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            """,
            0,
            "document.processed",
            "document-processor-worker",
            uuid7(),
            ts,
            "document",
            document.get("id"),
            json.dumps(payload),
            json.dumps(metadata),
        )

# =============================================================================
# CORE
# =============================================================================

async def handle(msg, consumer, pool, s3):
    async with semaphore:
        try:
            payload = json.loads(msg.data())

            event_id = payload.get("event_id")
            event_type = payload.get("event_type")
            document = payload.get("data") or {}
            metadata = payload.get("metadata") or {}

            doc_id = document.get("id")
            mime = document.get("mime_type")

            if not event_id or not doc_id:
                consumer.acknowledge(msg)
                return

            if event_type != "document.created":
                consumer.acknowledge(msg)
                return

            ts = int(time.time() * 1000)

            is_new = await try_insert_processed(pool, event_id, ts)
            if not is_new:
                consumer.acknowledge(msg)
                return

            # PROCESS
            if mime == "application/pdf":
                try:
                    checksum = await asyncio.wait_for(
                        process_pdf(pool, s3, S3_BUCKET, payload),
                        timeout=120
                    )
                except asyncio.TimeoutError:
                    logging.warning("PDF processing timeout")
                    consumer.negative_acknowledge(msg)
                    return

            # CHECKSUM REAL
            checksum = b""

            # OUTBOX
            await insert_outbox(pool, document, ts, checksum, metadata)

            consumer.acknowledge(msg)

        except Exception:
            logging.exception("error")
            consumer.negative_acknowledge(msg)

# =============================================================================
# WORKER LOOP
# =============================================================================
"""
Orchestrates asynchronous task dispatching by consuming messages from the internal queue 
and managing their lifecycle through active task tracking.
"""
async def worker_loop(consumer, pool, s3):
    while not shutdown_event.is_set():
        msg = await queue.get()

        task = asyncio.create_task(handle(msg, consumer, pool, s3))
        _active_tasks.add(task)

        task.add_done_callback(_active_tasks.discard)
        queue.task_done()

# =============================================================================
# LISTENER
# =============================================================================
"""
Continuously bridges blocking Pulsar message ingestion to the async queue using thread-safe event loop scheduling.
"""
def listener(loop, consumer):
    while True:
        try:
            msg = consumer.receive(timeout_millis=5000)
            if msg:
                fut = asyncio.run_coroutine_threadsafe(queue.put(msg), loop)
                fut.result()
        except Exception:
            continue

# =============================================================================
# SHUTDOWN
# =============================================================================

async def shutdown():
    logging.info("shutdown started")
    shutdown_event.set()

    await queue.join()

    for task in _active_tasks:
        task.cancel()

    await asyncio.gather(*_active_tasks, return_exceptions=True)

# =============================================================================
# MAIN
# =============================================================================

async def main():
    pool = await asyncpg.create_pool(
        dsn=POSTGRES_DSN,
        min_size=5,
        max_size=20
    )

    session = aioboto3.Session()

    client = pulsar.Client(PULSAR_URL)
    consumer = client.subscribe(
        TOPIC,
        subscription_name=SUBSCRIPTION_NAME,
        consumer_type=pulsar.ConsumerType.Shared,
        receiver_queue_size=200,
    )

    loop = asyncio.get_running_loop()
    
    # Spawns a daemon thread to bridge blocking Pulsar message ingestion with the async event loop.
    threading.Thread(
        target=listener,
        args=(loop, consumer),
        daemon=True
    ).start()

    workers = [
        asyncio.create_task(worker_loop(consumer, pool, session))
        for _ in range(2)
    ]

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown()))

    await asyncio.gather(*workers)

if __name__ == "__main__":
    asyncio.run(main())
