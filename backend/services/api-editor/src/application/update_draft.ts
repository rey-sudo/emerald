import { Pool } from "pg";
import { z } from "zod";
import * as Y from "yjs";
import { pool } from "../infrastructure/postgres/db.js";

export const UpdateDocumentSchema = z.object({
  command: z.literal("update_document"),
  params: z.object({
    documentId: z.string(),
    binario: z.instanceof(Uint8Array),
  }),
});

export async function handleUpdateDocument(
  params: z.infer<typeof UpdateDocumentSchema>["params"],
) {
  const now = Date.now(); // epoch en ms

  console.log(now);

  // params.binario es Uint8Array de Y.encodeStateAsUpdate(ydoc)
  const contentBinary = Buffer.from(params.binario);

  const query = `
    INSERT INTO drafts (
      id,
      user_id,
      folder_id,
      document_id,
      mime_type,
      content_binary,
      created_at,
      updated_at,
      v
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 1)
    ON CONFLICT (id) DO UPDATE SET
      content_binary = EXCLUDED.content_binary,
      updated_at     = EXCLUDED.updated_at,
      v              = drafts.v + 1
    RETURNING id, v, updated_at;
  `;

  const values = [
    "029d2612-a01d-734c-ab63-917106f31187",
    "019d2612-a01d-734c-ab63-917106f31187",
    "039d2612-a01d-734c-ab63-917106f31187",
    "039d2622-a01d-734c-ab63-917106f31187",
    "application/javascript",
    contentBinary, // Uint8Array → Buffer → BYTEA
    now,
  ];

  const client = await pool.connect();

  try {
    const result = await client.query(query, values);
    const row = result.rows[0];

    return {
      command: "update_document",
      documentId: params.documentId,
      v: row.v,
      updatedAt: row.updated_at,
      success: true,
    };
  } catch (error) {
    console.error("Error guardando draft:", error);
    throw error;
  } finally {
    client.release();
  }
}
