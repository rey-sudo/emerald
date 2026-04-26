import { FastifyRequest, FastifyReply } from "fastify";
import { pool } from "../infrastructure/postgres/db.js";
import { v7 as uuid7 } from "uuid";
import z from "zod";

const FolderCreateSchema = z.object({
  name: z.string().max(100),
  color: z.string().max(10),
});

export async function createFolderHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const logger = request.log;

  const parsed = FolderCreateSchema.safeParse(request.body);

  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);

    return reply.status(400).send({
      error: "Validation error",
      details: formatted,
    });
  }

  const { name, color } = parsed.data;

  const user_id = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: auth
  const folder_id = uuid7();
  const folder_status = "created";
  const storage_path = `${user_id}/${folder_id}`;
  const created_at = Date.now();
  const initial_v = 0;

  const query = `
        INSERT INTO folders (
          id, user_id, status, name, storage_path, color, created_at, v
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *;
      `;

  const eventQuery = `
        INSERT INTO events (
          specversion, event_type, source, id, time,
          entity_type, entity_id, data, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(query, [
      folder_id,
      user_id,
      folder_status,
      name,
      storage_path,
      color,
      created_at,
      initial_v,
    ]);

    if (!result.rows.length) {
      throw new Error("Error al insertar el registro");
    }

    const row = result.rows[0];

    const normalizedRow = {
      ...row,
      created_at: Number(row.created_at),
      v: Number(row.v)
    };

    const data_json = normalizedRow
    const meta_json = { user_id }

    await client.query(eventQuery, [
      0,
      "folder.created",
      "api-document",
      uuid7(),
      Date.now(),
      "folder",
      String(row.id),
      data_json,
      meta_json,
    ]);

    await client.query("COMMIT");

    return reply.status(201).send(row);
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Database error");

    return reply.status(500).send({
      error: "Could not create the folder in the database",
    });
  } finally {
    client.release();
  }
}
