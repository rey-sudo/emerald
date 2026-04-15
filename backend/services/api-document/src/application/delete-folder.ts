import { FastifyRequest, FastifyReply } from "fastify";
import { pool } from "../infrastructure/postgres/db.js";
import { v7 as uuid7 } from "uuid";
import z from "zod";

const ParamsSchema = z.object({
  id: z.uuid(),
});

export async function deleteFolderHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const logger = request.log;

  const parsed = ParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);

    return reply.status(400).send({
      error: "Validation error",
      details: formatted,
    });
  }

  const { id } = parsed.data;

  const user_id = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: auth
  const deleted_at = Date.now();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const query = `
      UPDATE folders
      SET
        status = 'deleted',
        updated_at = $1,
        deleted_at = $1,
        v = v + 1
      WHERE id = $2 AND user_id = $3
      RETURNING *;
    `;

    const result = await client.query(query, [
      deleted_at,
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
      deleted_at: Number(row.deleted_at),
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
      "folder.deleted",
      "api-document",
      uuid7(),
      Date.now(),
      "folder",
      String(row.id),
      normalizedRow,
      { user_id },
    ]);

    await client.query("COMMIT");

    return reply.status(200).send({
      success: true,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Database error");

    return reply.status(500).send({
      error: "Could not delete the folder",
    });
  } finally {
    client.release();
  }
}