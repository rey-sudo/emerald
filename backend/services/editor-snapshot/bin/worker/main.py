import asyncio
import json
import base64
import logging
import time
from collections import defaultdict

import pulsar
import asyncpg
import aioboto3

# ================= CONFIG =================

PULSAR_URL = "pulsar://broker:6650"
TOPIC = "persistent://public/default/chunk.created"
SUBSCRIPTION = "snapshot-worker"

S3_BUCKET = "documents"
S3_PREFIX = "docs/"

POSTGRES_DSN = "postgresql://postgres:password@postgres_global:5432/editor_snapshot"

# batching tuning
BATCH_MAX_MESSAGES = 500
SNAPSHOT_EVERY_N = 1000
SNAPSHOT_INTERVAL_SEC = 30

logging.basicConfig(level=logging.INFO)


# ================= DOC STATE =================

class DocState:
    __slots__ = (
        "doc_id",
        "updates",
        "count",
        "last_message_id",
        "last_snapshot_time",
    )

    def __init__(self, doc_id):
        self.doc_id = doc_id
        self.updates = []
        self.count = 0
        self.last_message_id = None
        self.last_snapshot_time = time.time()


# ================= WORKER =================

class SnapshotWorker:

    def __init__(self):
        self.client = pulsar.Client(PULSAR_URL)

        self.consumer = self.client.subscribe(
            TOPIC,
            subscription_name=SUBSCRIPTION,
            consumer_type=pulsar.ConsumerType.KeyShared,
            receiver_queue_size=2000,
            unacked_messages_timeout_ms=30000,  # redelivery safety
        )

        self.docs = {}
        self.pg_pool = None
        self.s3_session = aioboto3.Session()

    async def init(self):
        self.pg_pool = await asyncpg.create_pool(dsn=POSTGRES_DSN)

    # ---------- APPLY UPDATE ----------
    def apply_update(self, doc: DocState, update: bytes):
        doc.updates.append(update)
        doc.count += 1

    # ---------- SNAPSHOT ----------
    async def snapshot(self, doc: DocState):
        if not doc.updates:
            return

        doc_id = doc.doc_id

        # ⚠️ aquí deberías usar Y.js real
        snapshot_binary = b"".join(doc.updates)

        message_id = doc.last_message_id
        message_id_str = str(message_id)

        key = f"{S3_PREFIX}{doc_id}.bin"

        async with self.s3_session.client("s3") as s3:
            await s3.put_object(
                Bucket=S3_BUCKET,
                Key=key,
                Body=snapshot_binary,
                Metadata={
                    "doc_id": doc_id,
                    "pulsar_message_id": message_id_str,
                },
            )

        async with self.pg_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO snapshots (doc_id, s3_key, pulsar_message_id)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
                """,
                doc_id,
                key,
                message_id_str,
            )

        logging.info(f"[SNAPSHOT] doc={doc_id}")

        doc.updates.clear()
        doc.count = 0
        doc.last_snapshot_time = time.time()

    # ---------- PROCESS BATCH ----------
    async def process_batch(self, messages):

        # agrupar por doc_id (clave importante para 100k docs)
        grouped = defaultdict(list)

        for msg in messages:
            doc_id = msg.partition_key()
            grouped[doc_id].append(msg)

        # procesar por documento (mantiene orden)
        for doc_id, msgs in grouped.items():

            if doc_id not in self.docs:
                self.docs[doc_id] = DocState(doc_id)

            doc = self.docs[doc_id]

            for msg in msgs:
                data = json.loads(msg.data())
                update = base64.b64decode(data["update"])

                self.apply_update(doc, update)
                doc.last_message_id = msg.message_id()

            # snapshot trigger por tamaño
            if doc.count >= SNAPSHOT_EVERY_N:
                await self.snapshot(doc)

        # snapshot por tiempo (lazy)
        now = time.time()
        for doc in self.docs.values():
            if doc.count > 0 and (now - doc.last_snapshot_time > SNAPSHOT_INTERVAL_SEC):
                await self.snapshot(doc)

    async def process_batch_test(self, messages):
        logging.info("BATCH PROCESADO")
        logging.info(messages)
        
    # ---------- RUN ----------
    async def run(self):
        logging.info("Worker started (batch mode)")

        while True:
            try:
                messages = self.consumer.batch_receive()

                if not messages:
                    continue

                try:
                    await self.process_batch_test(messages)

                    for msg in messages:
                        self.consumer.acknowledge(msg)

                except Exception:
                    logging.exception("Batch failed")

                    for msg in messages:
                        self.consumer.negative_acknowledge(msg)

                    await asyncio.sleep(0.5)

            except Exception:
                logging.exception("Fatal loop error")
                await asyncio.sleep(1)

    async def close(self):
        self.consumer.close()
        self.client.close()
        await self.pg_pool.close()


# ================= MAIN =================

async def main():
    worker = SnapshotWorker()
    await worker.init()

    try:
        await worker.run()
    finally:
        await worker.close()


if __name__ == "__main__":
    asyncio.run(main())