import { FastifyRequest, FastifyReply } from "fastify";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v7 as uuidv7 } from "uuid";
import { pool } from "../infrastructure/postgres/db.js";
import z from "zod";

const SQL_SOFT_DELETE = `
  UPDATE documents
  SET status = 'deleted',
      updated_at = $1,
      deleted_at = $2,
      v = v + 1
  WHERE id = $3
    AND user_id = $4
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
  const timestamp = Date.now();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── 1. Soft delete ─────────────────────────────
    const { rows } = await client.query(SQL_SOFT_DELETE, [
      timestamp,
      timestamp,
      id,
      userId
    ]);

    const document = rows[0];
    if (!document) {
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
          Key: document.storage_path,
        }),
      );

      log.info(`[delete-document] S3 object deleted: ${document.storage_path}`);
    } catch (e) {
      await client.query("ROLLBACK");

      log.error(`[delete-document] S3 delete failed: ${e}`);

      return reply.status(502).send({
        message: "Error deleting file from storage.",
      });
    }

    const normalizedDocument = {
      ...document,
      size_bytes: Number(document.size_bytes),
      created_at: Number(document.created_at),
      updated_at: Number(document.updated_at),
      deleted_at: Number(document.deleted_at),
      v: Number(document.v),
    };

    // ── 3. Event ──────────────────────────────────────
    await client.query(SQL_INSERT_EVENT, [
      0,
      "document.deleted",
      "api-document",
      uuidv7(),
      timestamp,
      "document",
      document.id,
      normalizedDocument,
      { user_id: userId },
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