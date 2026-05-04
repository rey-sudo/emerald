import asyncio
import json
import logging
import signal
import time
from collections import defaultdict

import pulsar
import asyncpg
import aioboto3

# ================= CONFIG =================
PULSAR_URL = "pulsar://broker:6650"
TOPIC = "persistent://public/default/chunk.created"
SUBSCRIPTION = "snapshot-worker"
POSTGRES_DSN = "postgresql://postgres:password@postgres_global:5432/editor_snapshot"

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("SnapshotWorker")

# ================= WORKER =================

class SnapshotWorker:
    def __init__(self):
        self.client = pulsar.Client(PULSAR_URL)
        self.consumer = self.client.subscribe(
            TOPIC,
            subscription_name=SUBSCRIPTION,
            consumer_type=pulsar.ConsumerType.KeyShared,
            receiver_queue_size=2000,
            unacked_messages_timeout_ms=30000
        )
        self.pg_pool = None
        self.s3_session = aioboto3.Session()
        self.stop_event = asyncio.Event()

    async def init(self):
        logger.info("Connecting to Postgres...")
        self.pg_pool = await asyncpg.create_pool(dsn=POSTGRES_DSN, min_size=5, max_size=20)

# CONSUME CHUNKS TASK --------------------------------------------------------------------------------------------------

    async def _consume_task(self):
        """Tarea resiliente que persiste chunks en Postgres"""
        logger.info("Consumidor iniciado.")
        while not self.stop_event.is_set():
            try:
                # Pulsar batch_receive es bloqueante, lo movemos a un thread
                messages = await asyncio.to_thread(self.consumer.batch_receive)
                if not messages:
                    await asyncio.sleep(0.1)
                    continue

                try: 
                    #await self._persist_to_db(messages)
                    for msg in messages:
                        data = json.loads(msg.data())
                        logger.info(data)
                    
                    for msg in messages:
                        self.consumer.acknowledge(msg)
                        
                except Exception as e:
                    logger.error(f"Error persistiendo batch: {e}")
                    for msg in messages:
                        self.consumer.negative_acknowledge(msg)
                    await asyncio.sleep(1) # Backoff

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Error fatal en consumidor: {e}")
                await asyncio.sleep(2)

    async def _persist_to_db(self, messages):
        """Escribe chunks en la tabla con estado 'PENDING'"""
        async with self.pg_pool.acquire() as conn:
            async with conn.transaction():
                query = """
                    INSERT INTO editor_chunks (id, document_id, chunk, status, source, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6)
                """
                batch_data = []
                for msg in messages:
                    try:
                        data = json.loads(msg.data())
                        batch_data.append((msg.partition_key(), json.dumps(data)))
                    except Exception:
                        logger.error("Error parseando JSON del mensaje")
                
                if batch_data:
                    await conn.executemany(query, batch_data)

# PROCESS CHUNKS TASK --------------------------------------------------------------------------------------------------

    async def _processor_task(self):
        """Tarea que procesa chunks persistidos (ej. subir a S3)"""
        logger.info("Procesador de snapshots iniciado.")
        while not self.stop_event.is_set():
            try:
                # Espera 30s o hasta que se pida cerrar
                try:
                    await asyncio.wait_for(self.stop_event.wait(), timeout=30)
                    break # Si el evento se activa, salimos
                except asyncio.TimeoutError:
                    pass

                await self._process_pending_chunks()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error en procesador: {e}")
                await asyncio.sleep(5)

    async def _process_pending_chunks(self):
        """Lógica de negocio: Procesa de PENDING -> PROCESSING -> COMPLETED"""
        async with self.pg_pool.acquire() as conn:
            # 1. Marcamos registros para procesar (Atomicidad)
            ids = await conn.fetch("""
                UPDATE editor_chunk 
                SET status = 'PROCESSING'
                WHERE id IN (
                    SELECT id FROM editor_chunk 
                    WHERE status = 'PENDING' 
                    LIMIT 1000
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id, doc_id, data
            """)

            if not ids:
                return

            logger.info(f"Procesando {len(ids)} chunks...")
            
            # --- Aquí iría tu lógica de S3 con aioboto3 ---
            # ...
            
            # 2. Finalizamos
            chunk_ids = [r['id'] for r in ids]
            await conn.execute("UPDATE editor_chunk SET status = 'COMPLETED' WHERE id = ANY($1)", chunk_ids)
            logger.info(f"Batch de {len(ids)} procesado con éxito.")

    # ---------- ORQUESTACIÓN Y CIERRE SEGURO ----------
   
    async def close(self):
        logger.info("Limpiando recursos...")
        if self.consumer:
            self.consumer.close()
        if self.client:
            self.client.close()
        if self.pg_pool:
            await self.pg_pool.close()
        logger.info("Worker apagado correctamente.")   
   
    def _shutdown(self):
        logger.info("Shutdown signal received...")
        self.stop_event.set()

    async def run(self):
        # 1. Add signal handlers ---------------------------------------------------------------------------------------

        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, self._shutdown)
            except NotImplementedError: 
                pass
            
        # 2. Create worker tasks ---------------------------------------------------------------------------------------
        
        try:
            async with asyncio.TaskGroup() as tg:
                t1 = tg.create_task(self._consume_task())
                #t2 = tg.create_task(self._processor_task())
                
                await self.stop_event.wait()
                logger.info("Cerrando tareas concurrentes...")
                t1.cancel()
                #t2.cancel()
        except Exception as e:
            logger.error(f"Error en el TaskGroup: {e}")

# MAIN -----------------------------------------------------------------------------------------------------------------

async def main():
    worker = SnapshotWorker()
    await worker.init()
    try:
        await worker.run()
    finally:
        await worker.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass