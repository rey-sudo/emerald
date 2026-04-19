import { FastifyRequest, FastifyReply } from "fastify";
import { pool } from "../infrastructure/postgres/db.js";
import { v7 as uuidv7 } from "uuid";
import z from "zod";

const SQL_SOFT_DELETE_FOLDER = `
  UPDATE folders
  SET
    status = 'deleted',
    updated_at = $1,
    deleted_at = $2,
    v = v + 1
  WHERE id = $3 AND user_id = $4
  RETURNING *;
  `;

const SQL_SOFT_DELETE_DOCUMENTS_IN_FOLDER = `
  UPDATE documents
  SET
    status     = 'deleted',
    updated_at = $1,
    deleted_at = $2,
    v          = v + 1
  WHERE folder_id = $3
    AND user_id   = $4
    AND deleted_at IS NULL
  RETURNING *;
  `;

const SQL_INSERT_EVENT = `
  INSERT INTO events (
    specversion, event_type, source, id, time,
    entity_type, entity_id, data, metadata
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `;

const deleteFolderSchema = z.object({
  id: z.uuid(),
});

export async function deleteFolderHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const logger = request.log;

  const parsed = deleteFolderSchema.safeParse(request.params);
  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);

    return reply.status(400).send({
      error: "Validation error",
      details: formatted,
    });
  }

  const { id } = parsed.data;

  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: auth
  const timestamp = Date.now();
  const updated_at = timestamp;
  const deleted_at = timestamp;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Folder ownership and block --------------------------
    const lockFolder = await client.query(
      `SELECT id FROM folders WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [id, userId],
    );

    if (lockFolder.rowCount === 0) {
      await client.query("ROLLBACK"); 
      return reply.status(404).send({ error: "Folder not found" });
    }

    // 2. Soft delete folder ----------------------------------
    const result = await client.query(SQL_SOFT_DELETE_FOLDER, [
      updated_at,
      deleted_at,
      id,
      userId,
    ]);

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return reply.status(404).send({
        error: "Folder not found",
      });
    }

    const folder = result.rows[0];
    const normalizedRow = {
      ...folder,
      created_at: Number(folder.created_at),
      updated_at: Number(folder.updated_at),
      deleted_at: Number(folder.deleted_at),
      v: Number(folder.v),
    };

    // 3. Soft delete documents in folder ------------------------------------
    const documentsResult = await client.query(
      SQL_SOFT_DELETE_DOCUMENTS_IN_FOLDER,
      [updated_at, deleted_at, id, userId],
    );
   
    const documents = documentsResult.rows;
    //TODO: Bulk insert.
    for (const doc of documents) {
      const normalizedDoc = {
        ...doc,
        size_bytes: Number(doc.size_bytes),
        created_at: Number(doc.created_at),
        updated_at: Number(doc.updated_at),
        deleted_at: Number(doc.deleted_at),
        v: Number(doc.v),
      };

      await client.query(SQL_INSERT_EVENT, [
        0,
        "document.deleted",
        "api-document",
        uuidv7(),
        timestamp,
        "document",
        doc.id,
        normalizedDoc,
        { user_id: userId },
      ]);
    }

    await client.query(SQL_INSERT_EVENT, [
      0,
      "folder.deleted",
      "api-document",
      uuidv7(),
      timestamp,
      "folder",
      folder.id,
      normalizedRow,
      { user_id: userId },
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
