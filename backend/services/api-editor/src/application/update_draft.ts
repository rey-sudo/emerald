import { z } from "zod";
import { pool } from "../infrastructure/postgres/db.js";
import type { FastifyInstance } from "fastify";
import * as Y from "yjs";

export const UpdateDocumentSchema = z.object({
  command: z.literal("update_document"),
  params: z.object({
    documentId: z.string(),
    binario: z.instanceof(Uint8Array),
  }),
});

/**
 * Handles document updates by merging Yjs deltas and persisting to PostgreSQL.
 * Uses a 'SELECT FOR UPDATE' strategy to ensure atomic merges during concurrent edits.
 */
export async function handleUpdateDocument(
  app: FastifyInstance,
  params: z.infer<typeof UpdateDocumentSchema>["params"],
) {
  const timestamp = Date.now();

  const draftId = params.documentId;

  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: Replace with dynamic user context from request

  const incomingDelta = params.binario;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const selectQuery = `SELECT user_id, content_binary FROM drafts WHERE id = $1 AND user_id = $2 FOR UPDATE`;
    const response = await client.query(selectQuery, [draftId, userId]);

    const row = response.rows[0];
    const existingBinary = row?.content_binary;

    let finalBinary: Uint8Array;

    // Merge incoming delta with existing state if present; otherwise, initialize with delta.
    if (existingBinary) {
      const existingUint8 = new Uint8Array(existingBinary);
      finalBinary = Y.mergeUpdates([existingUint8, incomingDelta]);
    } else {
      finalBinary = incomingDelta;
    }

    const contentBuffer = Buffer.from(finalBinary);

    // Perform Upsert: Insert new draft or update existing content and version counter
    const upsertQuery = `
      INSERT INTO drafts (
        id, user_id, document_id, mime_type, 
        content_binary, created_at, updated_at, v
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        content_binary = EXCLUDED.content_binary,
        updated_at     = EXCLUDED.updated_at,
        v              = drafts.v + 1
      RETURNING id, v, updated_at;
    `;

    const upsertValues = [
      draftId,
      userId,
      draftId,
      "application/octet-stream",
      contentBuffer,
      timestamp,
      1,
    ];

    const upsertResult = await client.query(upsertQuery, upsertValues);

    await client.query("COMMIT");

    const upsertResultRow = upsertResult.rows[0];

    return {
      command: "update_document",
      documentId: params.documentId,
      v: upsertResultRow.v,
      updatedAt: upsertResultRow.updated_at,
      success: true,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error procesando delta del documento:", error);
    throw error;
  } finally {
    client.release();
  }
}
