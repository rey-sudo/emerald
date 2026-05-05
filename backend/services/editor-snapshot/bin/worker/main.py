import asyncio
import json
import logging
import signal
import time
from collections import defaultdict
from uuid6 import uuid7
import uuid
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

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

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=2, max=10),  
        retry=retry_if_exception_type(Exception), 
        reraise=True 
    )
    async def insert_outbox(conn, document, ts, checksum, metadata):
            payload = {
                "id": document.get("id"),
                "status": "PROCESSED",
                "checksum": checksum,
                "metadata": {},
                "v": document.get("v")
            }
            return await conn.execute(
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
                    await self._persist_to_db(messages)        
                
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
        """
        Estrategia optimizada para 100M+ registros.
        Maneja el desempaquetado de columnas para el UNNEST de Postgres.
        """
        # Listas independientes para cada columna (requerido por el unnest de asyncpg)
        ids, doc_ids, statuses, datas, sources, created_ats = [], [], [], [], [], []
        msg_map = {}

        for msg in messages:
            try:
                event = json.loads(msg.data())
                event_id = event.get("event_id")
                event_data = event.get("data")
                
                 #TODO: ADD TYPE VALIATION OF DATA AND EVENT - TO DLQ
                 
                if not event_id or not event_data:
                    logger.warning(f"Event malformed: {event_id}")
                    self.consumer.negative_acknowledge(msg)
                    continue
                
                logger.info(event)
                
                ids.append(uuid.UUID(event_id))
                doc_ids.append(uuid.UUID(event_data.get("document_id")))
                statuses.append(event_data.get("status"))
                datas.append(event_data.get("data"))
                sources.append(event_data.get("source"))
                created_ats.append(event_data.get("created_at"))
                
                # El mapa usa el objeto UUID para comparar con el RETURNING de la DB
                msg_map[event_id] = msg
                
            except Exception as e:
                logger.error(f"Error parseando mensaje: {e}")
                self.consumer.negative_acknowledge(msg)
                continue

        if not ids:
            return

        SQL_INSERT_QUERY = """
            INSERT INTO editor_chunks (id, document_id, status, data, source, created_at)
            SELECT * FROM unnest(
                $1::uuid[], $2::uuid[], $3::varchar[], $4::text[], $5::varchar[], $6::bigint[]
            )
            ON CONFLICT (id) DO NOTHING
            RETURNING id;
        """

        async with self.pg_pool.acquire() as conn:
            async with conn.transaction():
                try:
                    # Pasamos las listas directamente como argumentos
                    rows = await conn.fetch(
                        SQL_INSERT_QUERY, 
                        ids, doc_ids, statuses, datas, sources, created_ats
                    )
                    
                    inserted_ids = {str(row['id']) for row in rows}

                    for event_id, msg in msg_map.items():
                        
                        if event_id not in inserted_ids:
                            logger.warning(f"Evento duplicado ignorado: {event_id}")
                            
                #TX COMMIT IMPLICIT                      
                except Exception as e:
                    logger.error(f"Error en persistencia batch: {e}")
                    # Importante: No hagas ACK aquí para que el sistema de mensajería reintente el lote
                    raise 
                
        for msg in msg_map.values():
            self.consumer.acknowledge(msg)
            
            
            
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