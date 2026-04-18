import {
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { FastifyRequest, FastifyReply } from "fastify";
import { v7 as uuidv7 } from "uuid";
import type { File } from "fastify-multer/lib/interfaces";
import { pool } from "../infrastructure/postgres/db.js";
import multer from "fastify-multer";
import z from "zod";

/**
 * Map of supported MIME types to their corresponding file extensions.
 */
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/markdown": "md",
  "text/plain": "txt",
};

/**
 * Maximum allowed file size (100 MB).
 */
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/**
 * Multer middleware configuration for handling multipart/form-data.
 * Uses memory storage and validates file types against ALLOWED_MIME_TYPES.
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.split(";")[0].trim();
    if (mime in ALLOWED_MIME_TYPES) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type: '${mime}'. Allowed types: ${Object.keys(ALLOWED_MIME_TYPES).join(", ")}`,
        ),
      );
    }
  },
});

/**
 * Deletes an object from S3. Typically used as a compensating action
 * if a subsequent database transaction fails.
 * @param s3 - The S3 client instance.
 * @param bucket - S3 bucket name.
 * @param key - The object key (path) to delete.
 * @param log - Fastify logger instance.
 */
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

/**
 * Constructs a JSON string containing file metadata.
 * @param originalName - The original name of the uploaded file.
 * @param sizeBytes - File size in bytes.
 * @param folderId - UUID of the parent folder.
 * @returns A JSON stringified metadata object.
 */
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

// ── SQL ────────────────────────────────────────────────────────

const SQL_CHECK_FOLDER_OWNERSHIP = `
  SELECT 1 FROM folders WHERE id = $1 AND user_id = $2;
`;

const SQL_CHECK_FOLDER_OWNERSHIP_LOCKED = `
  SELECT 1 FROM folders WHERE id = $1 AND user_id = $2 FOR SHARE;
`;

const SQL_INSERT = `
  INSERT INTO documents (
    id, user_id, folder_id,
    original_name, internal_name,
    content_type, mime_type,
    size_bytes, storage_path,
    metadata,
    created_at, readed_at, updated_at, deleted_at,
    v
  ) VALUES (
    $1,  $2,  $3,
    $4,  $5,
    $6,  $7,
    $8,  $9,
    $10,
    $11, NULL, NULL, NULL,
    $12
  )
  RETURNING *;
`;

const SQL_INSERT_EVENT = `
  INSERT INTO events (
    specversion, event_type, source, id, time,
    entity_type, entity_id, data, metadata
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`;

/**
 * Zod schema for validating the upload request body.
 */
export const UploadFileBody = z.object({
  folder_id: z.uuid("folder_id must be a valid UUID"),
});

/**
 * Main handler for uploading files.
 * * Process:
 * 1. Validates the request body and file existence.
 * 2. Uploads the file buffer to AWS S3.
 * 3. Starts a DB transaction to record document metadata and a 'document.created' event.
 * 4. Performs a rollback and deletes the S3 object if the DB transaction fails.
 * @param request - Fastify request object containing the file and body.
 * @param reply - Fastify reply object.
 */
export async function uploadFileHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { s3, config, log } = request.server;

  const file = request.file as File;
  if (!file) {
    return reply.status(400).send({ message: "No file provided." });
  }

  const parsed = UploadFileBody.safeParse(request.body);
  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);

    return reply.status(400).send({
      error: "Validation error",
      details: formatted,
    });
  }

  const { folder_id: folderId } = parsed.data;

  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: authentication

  const folderCheck = await pool.query(SQL_CHECK_FOLDER_OWNERSHIP, [
    folderId,
    userId,
  ]);

  if (folderCheck.rowCount === 0) {
    return reply.status(403).send({
      message:
        "Access denied: Folder does not belong to user or does not exist.",
    });
  }

  const fileBuffer = file.buffer!;
  const rawContentType = file.mimetype; // "application/pdf; charset=utf-8"
  const mimeType = rawContentType.split(";")[0].trim(); // "application/pdf"
  const extension = ALLOWED_MIME_TYPES[mimeType];
  const originalName = file.originalname || `document.${extension}`;
  const sizeBytes = file.size!;

  log.debug(`filename=${originalName}`);
  log.debug(`content_type=${mimeType}`);
  log.debug(`folder_id=${folderId}`);

  const docId = uuidv7();
  const internalName = `${docId}.${extension}`;
  const storageKey = `${userId}/${folderId}/${internalName}`;
  const createdAt = Date.now();
  const metadata = buildMetadata(originalName, sizeBytes, folderId);
  const initialV = 0;

  // ── Phase 1: upload binary ────────────────────────────────

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: storageKey,
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
    log.info(`[upload-document] S3 object written: ${storageKey}`);
  } catch (e) {
    log.error(`[upload-document] S3 upload failed: ${e}`);
    return reply.status(502).send({ message: "Error uploading file to S3." });
  }

  // ── Phase 2: persist metadata ─────────────────────────────

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const folderCheck = await client.query(SQL_CHECK_FOLDER_OWNERSHIP_LOCKED, [
      folderId,
      userId,
    ]);

    if (folderCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      await deleteS3Object(s3, config.s3.bucket, storageKey, log);
      return reply.status(403).send({
        message:
          "Access denied: Folder does not belong to user or does not exist.",
      });
    }

    const { rows } = await client.query(SQL_INSERT, [
      docId, // $1  id
      userId, // $2  user_id
      folderId, // $3  folder_id
      originalName, // $4  original_name
      internalName, // $5  internal_name
      rawContentType, // $6  content_type
      mimeType, // $7  mime_type
      sizeBytes, // $8  size_bytes
      storageKey, // $9  storage_path
      metadata, // $10 metadata
      createdAt, // $11 created_at
      initialV, // $12 v
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
      "api-document", // $3 source
      uuidv7(), // $4 id
      Date.now(), // $5 time
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
      await deleteS3Object(s3, config.s3.bucket, storageKey, log);
      return reply
        .status(404)
        .send({ message: `The folder '${folderId}' does not exist.` });
    }

    if (e.code === "23505") {
      await deleteS3Object(s3, config.s3.bucket, storageKey, log);
      return reply
        .status(409)
        .send({ message: "A document with that identifier already exists." });
    }

    log.error(`[upload-document] DB insert failed: ${e}`);
    await deleteS3Object(s3, config.s3.bucket, storageKey, log);
    return reply
      .status(500)
      .send({ message: "Error registering the document." });
  } finally {
    client.release();
  }
}
