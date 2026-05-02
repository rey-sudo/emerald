import * as Y from 'yjs';
import Redis from 'ioredis';
import { PulsarClient } from 'pulsar-client';

const redis = new Redis({ host: 'localhost', port: 6379 });
const pulsarClient = new PulsarClient({ serviceUrl: 'pulsar://localhost:6650' });

interface SnapshotEvent {
  docId: string;
  lastChunkId: string; // El ID del Stream (ej: "1714350000000-0") que ya está en S3
}

async function handleSnapshotCreated(event: SnapshotEvent) {
  const { docId, lastChunkId } = event;
  const streamKey = `doc:${docId}:chunks`;
  const binaryKey = `doc:${docId}:bin`;

  // 1. Obtener todos los chunks hasta el lastChunkId inclusive
  // XRANGE devuelve los elementos desde el inicio hasta el ID procesado por el Snapshot Worker
  const chunksToClean = await redis.xrangeBuffer(streamKey, '-', lastChunkId);

  if (chunksToClean.length === 0) {
    console.log(`⚠️ No hay chunks pendientes para limpiar en el doc ${docId}`);
    return;
  }

  // 2. Obtener el binario base actual de Redis
  let currentBinary = await redis.getBuffer(binaryKey);
  
  // 3. Unificar los chunks en el binario de Redis
  const ydoc = new Y.Doc();
  if (currentBinary) {
    Y.applyUpdate(ydoc, currentBinary);
  }

  // En Streams, XRANGE ya nos da los elementos en orden cronológico (ID ascendente)
  for (const [id, fields] of chunksToClean) {
    // Los datos en Streams vienen en pares [campo, valor]. 
    // Si guardaste con: XADD key * "data" <binary>, el buffer está en el índice 1
    const chunkBuffer = fields[1]; 
    Y.applyUpdate(ydoc, chunkBuffer);
  }

  const updatedBinary = Buffer.from(Y.encodeStateAsUpdate(ydoc));

  // 4. TRANSACCIÓN ATÓMICA: Actualizar binario y PODAR el Stream
  const pipeline = redis.pipeline();
  
  // Guardamos el nuevo binario consolidado
  pipeline.set(binaryKey, updatedBinary);
  
  // XTRIM con MINID elimina todo lo que sea estrictamente menor al ID indicado.
  // Usamos el ID del evento para decir: "Todo lo que ya procesó el Snapshot Worker, bórralo".
  // Nota: El símbolo '~' es para optimización aproximada, pero sin él es exacto.
  pipeline.xtrim(streamKey, 'MINID', lastChunkId, 'LIMIT', 0); 
  
  // Importante: El último chunk (lastChunkId) debe ser borrado explícitamente 
  // si XTRIM MINID se usa de forma exclusiva. Para mayor seguridad:
  pipeline.xdel(streamKey, lastChunkId);

  // Refrescar TTL de 1h
  pipeline.expire(binaryKey, 3600);
  pipeline.expire(streamKey, 3600);

  await pipeline.exec();

  console.log(`🧹 Stream podado: ${chunksToClean.length} chunks integrados hasta ID: ${lastChunkId}`);
}

async function startCleaner() {
  const consumer = await pulsarClient.subscribe({
    topic: 'persistent://public/default/snapshot.created',
    subscription: 'cleaner-worker-group',
    subscriptionType: 'Shared',
  });

  console.log('🛡️ Cleaner Worker (Streams) activo...');

  while (true) {
    const msg = await consumer.receive();
    try {
      const event: SnapshotEvent = JSON.parse(msg.getData().toString());
      await handleSnapshotCreated(event);
      consumer.acknowledge(msg);
    } catch (err) {
      console.error('❌ Error en el Cleaner:', err);
      // En caso de error, Pulsar reintentará según la política de redelivery
      consumer.negativeAcknowledge(msg);
    }
  }
}

startCleaner().catch(console.error);