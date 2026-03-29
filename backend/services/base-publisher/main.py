import pulsar
import psycopg
from psycopg.rows import dict_row
import json
import time
import logging

# --- Configuración ---
DB_CONFIG = "host=localhost dbname=mi_db user=usuario password=password"
PULSAR_URL = 'pulsar://localhost:6650'

# Mapeo de tópicos por tipo de entidad
TOPICS = {
    "folder": "persistent://public/default/api-documents.folders",
    "document": "persistent://public/default/api-documents.documents"
}

def run_outbox_publisher():
    client = pulsar.Client(PULSAR_URL)
    producers = {} # Cache de producers para no recrearlos

    def get_producer(entity_type):
        topic = TOPICS.get(entity_type)
        if not topic:
            return None
        if topic not in producers:
            producers[topic] = client.create_producer(
                topic,
                block_if_queue_full=True,
                batching_enabled=True,
                batching_max_messages=100
            )
        return producers[topic]

    try:
        # En Psycopg 3, la conexión se puede usar como context manager
        with psycopg.connect(DB_CONFIG, autocommit=False) as conn:
            logging.info("🚀 Worker Outbox conectado y listo...")

            while True:
                # Usamos dict_row para acceder a las columnas por nombre
                with conn.cursor(row_factory=dict_row) as cur:
                    
                    # 1. Obtenemos un lote de eventos
                    cur.execute("""
                        SELECT * FROM events 
                        WHERE published = FALSE 
                        ORDER BY time ASC 
                        LIMIT 50 
                        FOR UPDATE SKIP LOCKED
                    """)
                    
                    rows = cur.fetchall()
                    
                    if not rows:
                        time.sleep(0.5)
                        continue

                    count = 0
                    for row in rows:
                        try:
                            # 2. Identificar el producer correcto
                            producer = get_producer(row['entity_type'])
                            if not producer:
                                logging.warning(f"Tipo desconocido: {row['entity_type']}")
                                continue

                            # 3. Publicar con Partition Key (entity_id)
                            # Esto garantiza el ORDEN cronológico por documento/carpeta
                            payload = json.dumps(row, default=str).encode('utf-8')
                            producer.send(
                                payload,
                                partition_key=str(row['entity_id'])
                            )
                            
                            # 4. Marcar como publicado
                            cur.execute("UPDATE events SET published = TRUE WHERE id = %s", [row['id']])
                            count += 1
                            
                        except Exception as e:
                            logging.error(f"❌ Error enviando evento {row['id']}: {e}")
                            # Si falla un envío, no marcamos ese registro; el commit final
                            # solo guardará los exitosos.

                    # 5. Confirmar el lote procesado
                    conn.commit()
                    if count > 0:
                        logging.info(f"✅ Lote de {count} eventos sincronizado.")

    except Exception as e:
        logging.critical(f"💥 Error fatal en el publicador: {e}")
    finally:
        for p in producers.values(): p.close()
        client.close()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    run_outbox_publisher()