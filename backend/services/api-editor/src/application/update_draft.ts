import { z } from "zod";
import * as Y from "yjs";
import { pool } from "../infrastructure/postgres/db.js";
import type { FastifyInstance } from "fastify";

export const UpdateDocumentSchema = z.object({
  command: z.literal("update_document"),
  params: z.object({
    documentId: z.string(),
    binario: z.instanceof(Uint8Array),
  }),
});

export async function handleUpdateDocument(
  app: FastifyInstance,
  params: z.infer<typeof UpdateDocumentSchema>["params"],
) {
  const now = Date.now();
  const draftId = "029d2612-a01d-734c-ab63-917106f31187";

  const client = await pool.connect();

  try {
    const selectQuery = `SELECT content_binary FROM drafts WHERE id = $1 FOR UPDATE`;

    const currentRes = await client.query(selectQuery, [draftId]);

    let finalBinary;
    const incomingDelta = params.binario;

    if (currentRes.rows.length > 0 && currentRes.rows[0].content_binary) {
      const existingBinary = currentRes.rows[0].content_binary;

      // Y.mergeUpdates combina el estado actual con el nuevo delta
      // Esto crea un nuevo binario que representa el estado final
      finalBinary = Y.mergeUpdates([existingBinary, incomingDelta]);
    } else {
      // Si no existe nada previo, el delta es el estado inicial
      finalBinary = incomingDelta;
    }

    const contentBuffer = Buffer.from(finalBinary);

    const upsertQuery = `
      INSERT INTO drafts (
        id, user_id, folder_id, document_id, mime_type, 
        content_binary, created_at, updated_at, v
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 1)
      ON CONFLICT (id) DO UPDATE SET
        content_binary = EXCLUDED.content_binary,
        updated_at     = EXCLUDED.updated_at,
        v              = drafts.v + 1
      RETURNING id, v, updated_at;
    `;

    const values = [
      draftId,
      "019d2612-a01d-734c-ab63-917106f31187",
      "039d2612-a01d-734c-ab63-917106f31187",
      "039d2622-a01d-734c-ab63-917106f31187",
      "application/octet-stream",
      contentBuffer,
      now,
    ];

    const result = await client.query(upsertQuery, values);
    const row = result.rows[0];

    return {
      command: "update_document",
      documentId: params.documentId,
      v: row.v,
      updatedAt: row.updated_at,
      success: true,
    };
  } catch (error) {
    console.error("Error procesando delta del documento:", error);
    throw error;
  } finally {
    client.release();
  }
}
