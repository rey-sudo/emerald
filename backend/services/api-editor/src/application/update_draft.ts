import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Piscina } from "piscina";
import * as Y from "yjs";

const piscina = new Piscina({
  filename: new URL("./update_draft_worker.mjs", import.meta.url).href,
  minThreads: 2,
  idleTimeout: 10000,
});

export const UpdateDocumentSchema = z.object({
  command: z.literal("update_document"),
  params: z.object({
    documentId: z.uuid(),
    binario: z.instanceof(Uint8Array).refine(
      (data) => {
        try {
          const doc = new Y.Doc();
          Y.applyUpdate(doc, data);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid Yjs binary" },
    ),
  }),
});

// Redis keys
const stateKey = (id: string) => `doc:${id}:state`;
const pendingKey = (id: string) => `doc:${id}:pending`;
const pubSubChan = (id: string) => `doc:${id}`;

// TTL del estado fusionado en Redis (24h). Si expira, el Worker lo reconstruye desde S3.
const STATE_TTL_SECONDS = 86_400;

export async function handleUpdateDocument(
  app: FastifyInstance,
  params: z.infer<typeof UpdateDocumentSchema>["params"],
) {
  const timestamp = Date.now();
  const draftId = params.documentId;
  const userId = "019d2612-a01d-734c-ab63-917106f31187";
  const incomingDelta = params.binario;

  try {
    // ─── 1. Leer estado actual fusionado desde Redis ───────────────────────────
    // getBuffer devuelve Buffer | null (ioredis). Si no existe aún, partimos de doc vacío.
    const rawState = await app.redis.getBuffer(stateKey(draftId));

    // ─── 2. Merge CRDT en un worker thread (no bloquea el event loop) ─────────
    // piscina serializa los Buffers a través de SharedArrayBuffer, evitando copia.
    // update_draft_worker.mjs aplica Y.applyUpdate y devuelve el nuevo state vector.
    const mergedStateBuffer: Buffer = await piscina.run(
      { rawState, incomingDelta },
      { name: "mergeYjsState" },
    );

    // ─── 3. Pipeline Redis: set estado, push chunk pendiente, broadcast pub/sub ─
    // Las tres operaciones van en un pipeline para minimizar round-trips.
    // NOTA: no es transacción atómica. En caso de race condition entre instancias,
    // el estado en Redis puede quedar con un merge parcial, pero el Worker siempre
    // reconstruye el estado correcto desde todos los chunks de Pulsar (CRDT idempotente).
    const deltaBuffer = Buffer.from(incomingDelta);

    await app.redis
      .pipeline()
      // Estado fusionado con TTL para que no acumule documentos huérfanos
      .set(stateKey(draftId), mergedStateBuffer, "EX", STATE_TTL_SECONDS)
      // Lista de chunks crudos pendientes que el Worker consume vía Pulsar.
      // LPUSH = inserción O(1) al inicio. El Worker lee desde el final (LRANGE + LTRIM).
      .lpush(pendingKey(draftId), deltaBuffer)
      // Pub/Sub: notifica a las demás instancias de MS-A para que reenvíen
      // el delta a sus clientes WebSocket conectados al mismo documento.
      .publish(pubSubChan(draftId), deltaBuffer)
      .exec();

    // ─── 4. Publicar en Apache Pulsar para el Snapshot Worker ─────────────────
    // partitionKey = documentId → KeyShared garantiza que todos los mensajes
    // del mismo documento llegan al mismo consumer en orden estricto.

    console.log("PUBLISHED TO PULSAR");

    return {
      command: "update_document",
      documentId: params.documentId,
      success: true,
    };

    //OUTBOX EVENT

    /** 
    await app.pulsarProducer.send({
      data: deltaBuffer,
      partitionKey: draftId,
      properties: {
        userId,
        timestamp: String(timestamp),
        // El Worker puede usar esto para decidir si hacer snapshot por tiempo
        // sin necesidad de parsear el binario Y.js.
        pendingKey: pendingKey(draftId),
      },
    });
*/
  } catch (error) {
    app.log.error(
      { error, draftId, userId, timestamp },
      "[handleUpdateDocument] fallo al procesar update Y.js",
    );
    // Re-throw: el handler de WebSocket decide si cerrar la conexión o enviar error al cliente
    throw error;
  }
}
