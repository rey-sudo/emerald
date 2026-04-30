import { z } from "zod";
import { pool } from "../infrastructure/postgres/db.js";
import type { FastifyInstance } from "fastify";
import { Piscina } from "piscina";
import * as Y from "yjs";

const piscina = new Piscina({
  filename: new URL("./update_draft_worker.mjs", import.meta.url).pathname,
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

export async function handleUpdateDocument(
  app: FastifyInstance,
  params: z.infer<typeof UpdateDocumentSchema>["params"],
) {
  const { s3, redis, pg_pool, log } = app;

  const timestamp = Date.now();

  const draftId = params.documentId;
  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: Replace with dynamic user context from request

  const deltaBinary = params.binario;

  const binaryKey = `doc:${draftId}:state`;
  const streamKey = `doc:${draftId}:chunks`;
  
  try {
    // 1. Check document authorization. ------------------------------------------------------------------------------------
    const documentResult = await pg_pool.query(
      "SELECT * FROM documents WHERE id = $1 AND user_id = $2",
      [draftId, userId],
    );

    // The original document does not exist
    if (documentResult.rows.length === 0) {
      log.warn(`Document not found in database.`);
      throw new Error("Document not found");
    }

    const updateBuffer = Buffer.from(
      deltaBinary.buffer,
      deltaBinary.byteOffset,
      deltaBinary.byteLength,
    );

    // 2. Operación Atómica en Redis (XADD + Renovar TTL)
    const pipeline = redis.pipeline();

    pipeline.xadd(streamKey, "*", "data", updateBuffer);

    //DELEGATE EXPIRE TO SNAPSHOT WORKER
    pipeline.expire(streamKey, 3600 * 2);
    pipeline.expire(binaryKey, 3600 * 2);

    const results = await pipeline.exec();
    if (!results) {
      throw new Error("Fallo al ejecutar el pipeline de Redis");
    }

    console.log(results);

    return {
      success: true,
      command: "update_document",
      data: {
        draftId,
      },
    };
  } catch (error) {
    log.error(error);
    throw error;
  }
}
