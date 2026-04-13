import { z } from "zod";
import { pool } from "../infrastructure/postgres/db.js";
import type { FastifyInstance } from "fastify";
import * as Y from "yjs";
import { Piscina } from "piscina";

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

    // 1. Ownership check to prevent unauthorized access
    const documentResult = await client.query(
      "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
      [draftId, userId],
    );

    if (documentResult.rows.length === 0) {
      throw new Error("Document not found");
    }

    // 2. Prevent race conditions using a session-level advisory lock on the document ID
    await client.query(
      "SELECT pg_advisory_xact_lock(('x' || left(md5($1), 16))::bit(64)::bigint)",
      [draftId],
    );

    // 3. Fetch current state with a row-level lock (FOR UPDATE)
    const response = await client.query(
      `SELECT content_binary FROM drafts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [draftId, userId],
    );

    const draft = response.rows[0];
    const existingBinary = draft?.content_binary;

    let finalBinary: Uint8Array;

    // 4. CRDT Logic: Merge incoming update with existing state using Y.js
    if (existingBinary) {
      try {
        finalBinary = await piscina.run({
          existingBinary,
          incomingDelta,
        });
      } catch (workerError) {
        app.log.error(workerError);
        throw new Error("Failed to merge document state");
      }
    } else {
      finalBinary = incomingDelta;
    }

    const contentBuffer = Buffer.from(finalBinary);

    // 5. Atomic Upsert: Update merged content and increment version counter
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
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
