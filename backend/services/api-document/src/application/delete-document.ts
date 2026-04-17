import { FastifyRequest, FastifyReply } from "fastify";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v7 as uuidv7 } from "uuid";
import { pool } from "../infrastructure/postgres/db.js";
import z from "zod";

// ── Types ────────────────────────────────────────────



// ── SQL ──────────────────────────────────────────────

const SQL_SOFT_DELETE = `
  UPDATE documents
  SET deleted_at = $1,
      updated_at = $1,
      v = v + 1
  WHERE id = $2
    AND deleted_at IS NULL
  RETURNING *;
`;

const SQL_INSERT_EVENT = `
  INSERT INTO events (
    specversion, event_type, source, id, time,
    entity_type, entity_id, data, metadata
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`;

export const deleteFileSchema = z.object({
  id: z.uuid("id must be a valid UUID")
});

export async function deleteDocumentHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { s3, config, log } = request.server;

  const parsed = deleteFileSchema.safeParse(request.params);

  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);

    return reply.status(400).send({
      error: "Validation error",
      details: formatted,
    });
  }

  const { id } = parsed.data;

  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO auth
  const now = Date.now();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── 1. Soft delete ────────────────────────────────
    const { rows } = await client.query(SQL_SOFT_DELETE, [
      now,
      id,
    ]);

    const row = rows[0];

    if (!row) {
      await client.query("ROLLBACK");
      return reply.status(404).send({
        message: `Document '${id}' not found or already deleted.`,
      });
    }

    // ── 2. Delete from S3 ─────────────────────────────
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: config.s3.bucket,
          Key: row.storage_path,
        }),
      );

      log.info(`[delete-document] S3 object deleted: ${row.storage_path}`);
    } catch (e) {
      await client.query("ROLLBACK");

      log.error(`[delete-document] S3 delete failed: ${e}`);

      return reply.status(502).send({
        message: "Error deleting file from storage.",
      });
    }

    const normalizedDocument = {
      ...row,
      size_bytes: Number(row.size_bytes),
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      deleted_at: Number(row.deleted_at),
      v: Number(row.v),
    };

    // ── 3. Event ──────────────────────────────────────
    await client.query(SQL_INSERT_EVENT, [
      0,
      "document.deleted",
      "api-document",
      uuidv7(),
      now,
      "document",
      row.id,
      normalizedDocument,
      JSON.stringify({ user_id: userId }),
    ]);

    await client.query("COMMIT");

    return reply.status(200).send(normalizedDocument);
  } catch (e) {
    await client.query("ROLLBACK");

    log.error(`[delete-document] failed: ${e}`);

    return reply.status(500).send({
      message: "Error deleting document.",
    });
  } finally {
    client.release();
  }
}