import { FastifyRequest, FastifyReply } from "fastify";
import {
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { v7 as uuidv7 } from "uuid";
import multer from "fastify-multer";
import type { File } from "fastify-multer/lib/interfaces";
import type { Pool } from "pg";
import { pool } from "../infrastructure/postgres/db.js";

// ── Constants ──────────────────────────────────────────────────

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/markdown": "md",
  "text/plain": "txt",
};

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

// ── Multer ─────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────

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

// ── Handler ────────────────────────────────────────────────────

export async function uploadFileHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { s3, config, log } = request.server;

  const file = request.file as File;
  const folderId = (request.body as any).folder_id as string;

  if (!file) {
    return reply.status(400).send({ message: "No file provided." });
  }

  if (!folderId) {
    return reply.status(400).send({ message: "folder_id is required." });
  }

  const fileBuffer = file.buffer!;
  const mimeType = file.mimetype.split(";")[0].trim();
  const ext = ALLOWED_MIME_TYPES[mimeType];
  const originalName = file.originalname || `document.${ext}`;
  const sizeBytes = file.size!;

  log.info(`filename=${originalName}`);
  log.info(`content_type=${mimeType}`);
  log.info(`folder_id=${folderId}`);

  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: authentication
  const docId = uuidv7();
  const internalName = `${docId}.${ext}`;
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

    const { rows } = await client.query(SQL_INSERT, [
      docId, // $1  id
      userId, // $2  user_id
      folderId, // $3  folder_id
      originalName, // $4  original_name
      internalName, // $5  internal_name
      mimeType, // $6  content_type
      mimeType, // $7  mime_type
      sizeBytes, // $8  size_bytes
      storageKey, // $9  storage_path
      metadata, // $10 metadata
      createdAt, // $11 created_at
      initialV, // $12 v
    ]);

    const row = rows[0];
    if (!row) throw new Error("INSERT RETURNING returned empty.");

    const normalizedDocument = {
      ...row,
      size_bytes: Number(row.size_bytes),
      created_at: Number(row.created_at),
      v: Number(row.v)
    };

    console.log(normalizedDocument);

    await client.query(SQL_INSERT_EVENT, [
      0, // $1 specversion
      "document.created", // $2 event_type
      "api-document", // $3 source
      uuidv7(), // $4 id
      Date.now(), // $5 time
      "document", // $6 entity_type
      row.id, // $7 entity_id
      normalizedDocument, // $8 data
      JSON.stringify({ user_id: userId }), // $9 metadata
    ]);

    await client.query("COMMIT");

    // TODO: Dispatch Pub/Sub event

    return reply.status(201).send(row);
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
