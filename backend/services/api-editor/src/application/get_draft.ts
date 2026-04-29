import { z } from "zod";
import type { FastifyInstance } from "fastify";
import * as Y from "yjs";

export const GetDocumentSchema = z.object({
  command: z.literal("get_document"),
  params: z.object({ documentId: z.string() }),
});

// Mismas convenciones de keys que en handleUpdateDocument
const stateKey = (id: string) => `doc:${id}:state`;
const STATE_TTL_SECONDS = 86_400;

type GetDocumentResult = {
  state: Buffer; // Uint8Array Y.js listo para Y.applyUpdate en el cliente
  version: number; // Versión del snapshot en PostgreSQL
  source: "redis" | "s3" | "empty"; // Para observabilidad / debugging
};

const SQL_SNAPSHOT = `
  SELECT s3_key, version
  FROM document_snapshots
  WHERE document_id = $1
  ORDER BY version DESC
  LIMIT 1
  `;

export async function handleGetDocument(
  app: FastifyInstance,
  params: z.infer<typeof GetDocumentSchema>["params"],
): Promise<GetDocumentResult> {
  const { documentId } = params;

  const client = await app.pg_pool.connect();
  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: Replace with dynamic user context from request

  //OWNERSHIP AND COLABORATORS

  //S3 ORIGINAL Y.JS BINARY must be exists

  // 1. IF DRAFT CACHE EXISTS --------------------------------------------
  const cached = await app.redis.getBuffer(stateKey(documentId));
  if (cached) {
    app.log.debug({ documentId }, "[getDocument] cache hit");
    return { state: cached, version: -1, source: "redis" };
  }

  // CHECK SNAPSHOT -------------------------------------------------------
  app.log.debug({ documentId }, "Checking snapshot in PostgreSQL");
  const snapshot = await client.query(SQL_SNAPSHOT, [documentId, userId]);

  // 2. IF SNAPSHOT NOT EXISTS---------------------------------------------
  if (!snapshot) {
    app.log.info(
      { documentId },
      "[getDocument] documento sin snapshots previos",
    );

    const emptyDoc = new Y.Doc();
    const emptyState = Buffer.from(Y.encodeStateAsUpdate(emptyDoc));

    // Sembramos Redis para que el próximo GET no llegue hasta PG
    await app.redis.set(
      stateKey(documentId),
      emptyState,
      "EX",
      STATE_TTL_SECONDS,
    );

    return { state: emptyState, version: 0, source: "empty" };
  }

  // ─── 4. Descargar binario desde S3 ────────────────────────────────────────
  app.log.info(
    { documentId, s3Key: snapshot.s3_key },
    "[getDocument] descargando snapshot desde S3",
  );

  const s3Object = await app.s3.getObject({
    Bucket: process.env.S3_SNAPSHOTS_BUCKET!,
    Key: snapshot.s3_key,
  });

  // S3 devuelve un stream; lo consumimos completo antes de continuar.
  const s3Buffer = await streamToBuffer(s3Object.Body);

  // ─── 5. Validar que el binario es un Y.js válido ──────────────────────────
  try {
    const testDoc = new Y.Doc();
    Y.applyUpdate(testDoc, s3Buffer);
  } catch (err) {
    app.log.error(
      { err, documentId, s3Key: snapshot.s3_key },
      "[getDocument] snapshot S3 corrupto — no se puede aplicar como Y.js update",
    );
    throw new Error(`Snapshot corrupto para documento ${documentId}`);
  }

  // ─── 6. Repopular Redis (warm-up del cache) ───────────────────────────────
  // A partir de aquí, los próximos GETs y los updates entrantes
  // encontrarán el estado en Redis sin volver a S3.
  await app.redis.set(stateKey(documentId), s3Buffer, "EX", STATE_TTL_SECONDS);

  app.log.info(
    { documentId, version: snapshot.version },
    "[getDocument] estado restaurado desde S3 y cargado en Redis",
  );

  return { state: s3Buffer, version: snapshot.version, source: "s3" };
}

// ─── Helper: consumir un ReadableStream de S3 en un solo Buffer ───────────
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
