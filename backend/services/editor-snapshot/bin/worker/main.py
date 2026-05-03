import asyncio
import logging
import os
import signal
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import List

import pulsar


# ─── Config ───────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Config:
    pulsar_url: str = os.getenv("PULSAR_URL", "pulsar://broker:6650")
    topic: str = os.getenv("PULSAR_TOPIC", "persistent://public/default/chunk.created")
    subscription: str = os.getenv("PULSAR_SUB", "sub-keyshared-prod")
    dead_letter_topic: str = os.getenv("PULSAR_DLT", "persistent://public/default/mi-topico-DLT")

    batch_max_messages: int = int(os.getenv("BATCH_MAX_MESSAGES", "200"))
    batch_max_bytes: int = int(os.getenv("BATCH_MAX_BYTES", str(5 * 1024 * 1024)))
    batch_timeout_ms: int = int(os.getenv("BATCH_TIMEOUT_MS", "500"))

    receiver_queue_size: int = int(os.getenv("RECEIVER_QUEUE_SIZE", "500"))

    max_redeliver_count: int = int(os.getenv("MAX_REDELIVER_COUNT", "5"))
    nack_delay_ms: int = int(os.getenv("NACK_DELAY_MS", "1000"))

    receive_timeout_ms: int = int(os.getenv("RECEIVE_TIMEOUT_MS", "1000"))

    log_level: str = os.getenv("LOG_LEVEL", "INFO")


# ─── Idempotencia (HOOK) ──────────────────────────────────────────────────────

class IdempotencyStore:
    """
    Implementa Redis / DB en producción.
    Aquí es solo placeholder.
    """

    def __init__(self):
        self._seen = set()

    def seen(self, msg_id: str) -> bool:
        return msg_id in self._seen

    def mark(self, msg_id: str):
        self._seen.add(msg_id)


# ─── Lógica de negocio ────────────────────────────────────────────────────────

async def process_message(msg) -> bool:
    """
    Procesa UN mensaje.
    Retorna True si OK, False si debe reintentarse.
    """
    try:
        value = msg.data().decode("utf-8", errors="replace")
        await asyncio.sleep(0.001)  # simula IO
        return True
    except Exception:
        return False


# ─── Worker ───────────────────────────────────────────────────────────────────

class Worker:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._running = True
        self._client = None
        self._consumer = None
        self._idempotency = IdempotencyStore()

    def _connect(self):
        self._client = pulsar.Client(
            self.cfg.pulsar_url,
            logger=pulsar.ConsoleLogger(pulsar.LoggerLevel.Warn),
        )

        self._consumer = self._client.subscribe(
            self.cfg.topic,
            subscription_name=self.cfg.subscription,
            consumer_type=pulsar.ConsumerType.KeyShared,
            batch_receive_policy=pulsar.ConsumerBatchReceivePolicy(
                self.cfg.batch_max_messages,
                self.cfg.batch_max_bytes,
                self.cfg.batch_timeout_ms,
            ),
            dead_letter_policy=pulsar.ConsumerDeadLetterPolicy(
                dead_letter_topic=self.cfg.dead_letter_topic,
                max_redeliver_count=self.cfg.max_redeliver_count,
            ),
            receiver_queue_size=self.cfg.receiver_queue_size,
            negative_ack_redelivery_delay_ms=self.cfg.nack_delay_ms,
        )

    def _disconnect(self):
        if self._consumer:
            self._consumer.close()
        if self._client:
            self._client.close()

    async def _receive(self, pool):
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(pool, lambda: self._consumer.batch_receive())

    async def _process_batch(self, messages: List):
        ok, fail = 0, 0
        
        logging.info(messages)

        for msg in messages:
            msg_id = str(msg.message_id())

            # ── Idempotencia ──
            if self._idempotency.seen(msg_id):
                self._consumer.acknowledge(msg)
                continue

            success = await process_message(msg)

            if success:
                self._consumer.acknowledge(msg)
                self._idempotency.mark(msg_id)
                ok += 1
            else:
                self._consumer.negative_acknowledge(msg)
                fail += 1

        return ok, fail

    async def run(self):
        self._connect()

        logging.info("Worker iniciado | sub=%s", self.cfg.subscription)

        with ThreadPoolExecutor(max_workers=1) as pool:
            while self._running:
                try:
                    messages = await self._receive(pool)

                    if not messages:
                        continue

                    t0 = time.perf_counter()

                    ok, fail = await self._process_batch(messages)

                    elapsed = time.perf_counter() - t0

                    logging.info(
                        "batch=%d ok=%d fail=%d time=%.3fs",
                        len(messages), ok, fail, elapsed
                    )

                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logging.error("Loop error: %s", e, exc_info=True)
                    await asyncio.sleep(1)

        self._disconnect()
        logging.info("Worker detenido")

    def stop(self):
        logging.info("Shutdown solicitado")
        self._running = False


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    cfg = Config()

    logging.basicConfig(
        level=getattr(logging, cfg.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
        stream=sys.stdout,
    )

    worker = Worker(cfg)

    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, worker.stop)

    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())