import path from "path";
import { FastifyRequest, FastifyReply } from "fastify";
import { v7 as uuidv7 } from "uuid";
import { pool } from "../infrastructure/postgres/db.js";
import z from "zod";

const SQL_GET_EXTENSION = `
  SELECT 
    internal_name
  FROM documents
  WHERE id = $1
    AND user_id = $2
    AND deleted_at IS NULL;
`;

const SQL_UPDATE_NAME = `
  UPDATE documents
  SET original_name = $1,
      updated_at = $2,
      v = v + 1
  WHERE id = $3
    AND deleted_at IS NULL
  RETURNING *;
`;

const SQL_INSERT_EVENT = `
  INSERT INTO events (
    specversion, event_type, source, id, time,
    entity_type, entity_id, data, metadata
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`;

export const updateFileSchema = z.object({
  id: z.uuid("id must be a valid UUID"),
  original_name: z.string().trim().min(1, "original_name is required."), //TODO
});

export async function updateDocumentHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { log } = request;

  const parsed = updateFileSchema.safeParse(request.body);
  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);

    return reply.status(400).send({
      error: "Validation error",
      details: formatted,
    });
  }

  const { id, original_name } = parsed.data;

  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: auth
  const now = Date.now();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: extRows } = await client.query(SQL_GET_EXTENSION, [
      id,
      userId
    ]);

    const current = extRows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return reply.status(404).send({ message: "Document not found" });
    }

    const extension = path.extname(current.internal_name);

    const finalName = `${original_name.trim()}${extension}`;

    const { rows } = await client.query(SQL_UPDATE_NAME, [
      finalName, // $1
      now, // $2 updated_at
      id, // $3
    ]);

    const document = rows[0];
    if (!document) {
      await client.query("ROLLBACK");
      return reply.status(404).send({
        message: `Document '${id}' not found.`,
      });
    }

    const normalizedDocument = {
      ...document,
      size_bytes: Number(document.size_bytes),
      created_at: Number(document.created_at),
      updated_at: Number(document.updated_at),
      v: Number(document.v),
    };

    await client.query(SQL_INSERT_EVENT, [
      0,
      "document.updated",
      "api-document",
      uuidv7(),
      now,
      "document",
      document.id,
      normalizedDocument,
      { user_id: userId },
    ]);

    await client.query("COMMIT");

    return reply.status(200).send(normalizedDocument);
  } catch (e) {
    await client.query("ROLLBACK");
    log.error(`[update-document] rename failed: ${e}`);

    return reply.status(500).send({
      message: "Error updating document name.",
    });
  } finally {
    client.release();
  }
}
