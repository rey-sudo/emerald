import type { FastifyReply, FastifyRequest } from "fastify";
import { pool } from "../infrastructure/postgres/db.js";

interface Document {
  id: string;
  originalName: string;
  internalName: string;
  contentType: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  status: string;
  checksum: string | null;
  context: string | null;
  keywords: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number | null;
  updatedAt: number | null;
}

interface Folder {
  folderId: string;
  userId: string;
  folderName: string;
  folderStatus: string;
  color: string;
  folderStoragePath: string;
  folderCreatedAt: number | null;
  folderUpdatedAt: number | null;
  documents: Document[];
}

const GET_FOLDERS_QUERY = `
  SELECT
    f.id           AS folder_id,
    f.user_id,
    f.name         AS folder_name,
    f.status       AS folder_status,
    f.color,
    f.storage_path AS folder_storage_path,
    f.created_at   AS folder_created_at,
    f.updated_at   AS folder_updated_at,

    COALESCE(
      json_agg(
        json_build_object(
          'id',           d.id,
          'originalName', d.original_name,
          'internalName', d.internal_name,
          'contentType',  d.content_type,
          'mimeType',     d.mime_type,
          'sizeBytes',    d.size_bytes,
          'storagePath',  d.storage_path,
          'status',       d.status,
          'checksum',     d.checksum,
          'context',      d.context,
          'keywords',     d.keywords,
          'metadata',     d.metadata,
          'createdAt',    d.created_at,
          'updatedAt',    d.updated_at
        ) ORDER BY d.created_at DESC
      ) FILTER (WHERE d.id IS NOT NULL),
      '[]'
    ) AS documents

  FROM folders f
  LEFT JOIN documents d
         ON d.folder_id = f.id
        AND d.deleted_at IS NULL
  WHERE f.user_id    = $1
    AND f.deleted_at IS NULL
  GROUP BY f.id
  ORDER BY f.created_at DESC;
`;

export async function getFoldersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = "019d2612-a01d-734c-ab63-917106f31187";

  const { rows } = await pool.query<Folder>(GET_FOLDERS_QUERY, [userId]);

  return reply.code(200).send(rows);
}
