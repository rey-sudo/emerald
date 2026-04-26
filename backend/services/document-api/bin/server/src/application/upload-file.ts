import z from "zod";
import {
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { FastifyRequest, FastifyReply } from "fastify";
import { MultipartFile, MultipartValue } from "@fastify/multipart";
import { v7 as uuidv7 } from "uuid";

// SQL -------------------------------------------------------------
const SQL_CHECK_FOLDER_OWNERSHIP = `
  SELECT 1 FROM folders WHERE id = $1 AND user_id = $2;
`;

const SQL_CHECK_FOLDER_OWNERSHIP_LOCKED = `
  SELECT 1 FROM folders WHERE id = $1 AND user_id = $2 FOR SHARE;
`;

const SQL_INSERT_DOCUMENT = `
  INSERT INTO documents (
    id, user_id, folder_id,
    original_name, internal_name,
    content_type, mime_type,
    size_bytes, storage_path,
    metadata, created_at,
    v
  ) VALUES (
    $1,  $2,  $3,
    $4,  $5,
    $6,  $7,
    $8,  $9,
    $10, $11,
    $12
  )
  RETURNING *;
`;

const SQL_INSERT_EVENT = `
  INSERT INTO events (
    specversion, event_type, source, id, time,
    entity_type, entity_id, data, metadata)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`;

// MIME_TYPES -------------------------------------------------------------
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/markdown": "md",
  "text/plain": "txt",
};

// DELETE S3 OBJECT -------------------------------------------------------
async function deleteS3Object(
  s3: S3Client,
  bucket: string,
  key: string,
  log: FastifyRequest["log"],
): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    log.info(`[S3Service] Compensating DELETE succeeded: ${key}`);
  } catch (e) {
    log.error(`[S3Service] Compensating DELETE failed for '${key}': ${e}`);
  }
}

// BUILD METADATA -------------------------------------------------------
function buildMetadata(
  originalName: string,
  sizeBytes: number,
  folderId: string,
): string {
  return JSON.stringify({
    original_name: originalName,
    size_bytes: sizeBytes,
    folder_id: folderId,
  });
}

// ZOD PARAMS SCHEMA ----------------------------------------------------
export const UploadFileBody = z.object({
  folder_id: z.uuid("folder_id must be a valid UUID"),
});

//UPLOAD FILE HANDLER
export async function uploadFileHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { s3, config, log, pg_pool } = request.server;

  const body = request.body as {
    folder_id?: MultipartValue<string>;
    file?: MultipartFile;
  };

  // 1. FILE VERIFICATION -----------------------------------------------
  const file = body.file;
  if (!file) return reply.status(400).send({ message: "No file provided." });
  log.debug("RECEIVED FILE");

  const rawContentType = file.mimetype;
  const mimeType = rawContentType.split(";")[0].trim();
  if (!(mimeType in ALLOWED_MIME_TYPES)) {
    return reply.status(415).send({
      message: `Unsupported file type: '${mimeType}'`,
    });
  }

  // 2. ZOD VERIFICATION ------------------------------------------------
  const parsed = UploadFileBody.safeParse({
    folder_id: body.folder_id?.value,
  });
  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);
    return reply
      .status(400)
      .send({ error: "Validation error", details: formatted });
  }
  log.debug("ZOD VERIFIED");

  // VARIABLE DECLARATIONS ----------------------------------------------
  const { folder_id: folderId } = parsed.data;
  const timestamp = Date.now();
  const userId = "019d2612-a01d-734c-ab63-917106f31187";
  const fileBuffer = await file.toBuffer();
  const extension = ALLOWED_MIME_TYPES[mimeType];
  const originalName = file.filename || `document.${extension}`;
  const sizeBytes = fileBuffer.length;

  const docId = uuidv7();
  const internalName = `${docId}.${extension}`;
  const storagePath = `${userId}/${folderId}/${internalName}`;
  const createdAt = timestamp;
  const metadata = buildMetadata(originalName, sizeBytes, folderId);
  const v = 0;

  log.debug(`filename=${originalName}`);
  log.debug(`content_type=${mimeType}`);
  log.debug(`folder_id=${folderId}`);

  // 3. OWNERSHIP VERIFICATION --------------------------------------------
  const folderCheck = await pg_pool.query(SQL_CHECK_FOLDER_OWNERSHIP, [
    folderId,
    userId,
  ]);

  if (folderCheck.rowCount === 0) {
    return reply.status(403).send({
      message:
        "Access denied: Folder does not belong to user or does not exist.",
    });
  }

  // 4. UPLOAD FILE ---------------------------------------------------------
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: storagePath,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          "document-id": docId,
          "folder-id": folderId,
          "user-id": userId,
          "original-name": originalName,
          "internal-name": internalName,
        },
      }),
    );
    log.info(`[upload-document] S3 object written: ${storagePath}`);
  } catch (e) {
    log.error(`[upload-document] S3 upload failed: ${e}`);
    return reply.status(502).send({ message: "Error uploading file to S3." });
  }

  // 5. CREATE DOCUMENT --------------------------------------------------------
  const client = await pg_pool.connect();

  try {
    await client.query("BEGIN");

    // 6. LOCK FOLDER WHILE TRANSACTION -----------------------------------------
    const folderCheck = await client.query(SQL_CHECK_FOLDER_OWNERSHIP_LOCKED, [
      folderId,
      userId,
    ]);

    if (folderCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      await deleteS3Object(s3, config.s3.bucket, storagePath, log);
      return reply.status(403).send({
        message:
          "Access denied: Folder does not belong to user or does not exist.",
      });
    }

    const { rows } = await client.query(SQL_INSERT_DOCUMENT, [
      docId, // $1  id
      userId, // $2  user_id
      folderId, // $3  folder_id
      originalName, // $4  original_name
      internalName, // $5  internal_name
      rawContentType, // $6  content_type
      mimeType, // $7  mime_type
      sizeBytes, // $8  size_bytes
      storagePath, // $9  storage_path
      metadata, // $10 metadata
      createdAt, // $11 created_at
      v, // $12 v
    ]);

    const document = rows[0];
    if (!document) throw new Error("INSERT RETURNING returned empty.");

    const normalizedDocument = {
      ...document,
      size_bytes: Number(document.size_bytes),
      created_at: Number(document.created_at),
      v: Number(document.v),
    };

    await client.query(SQL_INSERT_EVENT, [
      0, // $1 specversion
      "document.created", // $2 event_type
      "document-api-server", // $3 source
      uuidv7(), // $4 id
      timestamp, // $5 time
      "document", // $6 entity_type
      document.id, // $7 entity_id
      normalizedDocument, // $8 data
      { user_id: userId }, // $9 metadata
    ]);

    await client.query("COMMIT");

    // TODO: Dispatch Pub/Sub event

    return reply.status(201).send(normalizedDocument);
  } catch (e: any) {
    await client.query("ROLLBACK");

    if (e.code === "23503") {
      await deleteS3Object(s3, config.s3.bucket, storagePath, log);
      return reply
        .status(404)
        .send({ message: `The folder '${folderId}' does not exist.` });
    }

    if (e.code === "23505") {
      await deleteS3Object(s3, config.s3.bucket, storagePath, log);
      return reply
        .status(409)
        .send({ message: "A document with that identifier already exists." });
    }

    log.error(`[upload-document] DB insert failed: ${e}`);
    await deleteS3Object(s3, config.s3.bucket, storagePath, log);
    return reply
      .status(500)
      .send({ message: "Error registering the document." });
  } finally {
    client.release();
  }
}
