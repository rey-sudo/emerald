import { FastifyRequest, FastifyReply } from "fastify";
import { v7 as uuid7 } from "uuid";
import z from "zod";

const SQL_INSERT_FOLDER = `
  INSERT INTO folders (
    id, user_id, status, name, storage_path, color, created_at, v)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *;
  `;

const SQL_INSERT_EVENT = `
  INSERT INTO events (
    specversion, event_type, source, id, time,
    entity_type, entity_id, data, metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `;

const FolderCreateSchema = z.object({
  name: z.string().max(100),
  color: z.string().max(10),
});

export async function createFolderHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { log, pg_pool } = request.server;

  // 1. ZOD VERIFICATION -----------------------------------
  const parsed = FolderCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);

    return reply.status(400).send({
      error: "Validation error",
      details: formatted,
    });
  }

  //-----------------------------------------------------------
  const { name: folderName, color: folderColor } = parsed.data;

  const timestamp = Date.now();
  const folderId = uuid7();
  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: auth
  const folderStatus = "created";
  const storagePath = `${userId}/${folderId}`;
  const createdAt = timestamp;
  const v = 0;

  const client = await pg_pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(SQL_INSERT_FOLDER, [
      folderId,
      userId,
      folderStatus,
      folderName,
      storagePath,
      folderColor,
      createdAt,
      v
    ]);

    if (!result.rows.length) {
      throw new Error("Error creating folder");
    }

    const folder = result.rows[0];
    const normalizedFolder = {
      ...folder,
      created_at: Number(folder.created_at),
      v: Number(folder.v),
    };

    const data_json = normalizedFolder;
    const meta_json = {};

    await client.query(SQL_INSERT_EVENT, [
      0,
      "folder.created",
      "document-api-server",
      uuid7(),
      timestamp,
      "folder",
      String(folder.id),
      data_json,
      meta_json,
    ]);

    await client.query("COMMIT");

    return reply.status(201).send(normalizedFolder);
  } catch (err) {
    await client.query("ROLLBACK");
    log.error({ err }, "Database error");

    return reply.status(500).send({
      error: "Could not create the folder in the database",
    });
  } finally {
    client.release();
  }
}
