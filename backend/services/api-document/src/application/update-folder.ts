import { FastifyRequest, FastifyReply } from "fastify";
import { pool } from "../infrastructure/postgres/db.js";
import { v7 as uuid7 } from "uuid";
import z from "zod";

const FolderUpdateSchema = z
  .object({
    id: z.uuid(),
    name: z.string().max(100).optional(),
    color: z.string().max(10).optional(),
  })
  .refine((data) => data.name || data.color, {
    message: "At least one field (name or color) must be provided",
  });

export async function updateFolderHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const logger = request.log;

  const parsed = FolderUpdateSchema.safeParse(request.body);

  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);

    return reply.status(400).send({
      error: "Validation error",
      details: formatted,
    });
  }

  const { id, name, color } = parsed.data;

  const user_id = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: auth
  const updated_at = Date.now();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const query = `
    UPDATE folders
    SET
        name = COALESCE($1, name),
        color = COALESCE($2, color),
        updated_at = $3,
        v = v + 1
    WHERE id = $4 AND user_id = $5
    RETURNING *;
    `;

    const result = await client.query(query, [
      name ?? null,
      color ?? null,
      updated_at,
      id,
      user_id,
    ]);

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return reply.status(404).send({
        error: "Folder not found",
      });
    }

    const row = result.rows[0];

    const normalizedRow = {
      ...row,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      v: Number(row.v),
    };

    const eventQuery = `
      INSERT INTO events (
        specversion, event_type, source, id, time,
        entity_type, entity_id, data, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `;

    await client.query(eventQuery, [
      0,
      "folder.updated",
      "api-document",
      uuid7(),
      Date.now(),
      "folder",
      String(row.id),
      normalizedRow,
      { user_id },
    ]);

    await client.query("COMMIT");

    return reply.status(200).send(row);
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Database error");

    return reply.status(500).send({
      error: "Could not update the folder in the database",
    });
  } finally {
    client.release();
  }
}
