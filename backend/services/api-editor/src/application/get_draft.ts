import { z } from "zod";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const GetDocumentSchema = z.object({
  command: z.literal("get_document"),
  params: z.object({ documentId: z.string() }),
});

export type DocumentFormat = "json" | "binary";

export interface GetDocumentResponse {
  success: boolean;
  message: string;
  command: "get_document";
  data: {
    documentId: string;
    format: DocumentFormat;
    content: any;
    isNew: boolean;
  };
}

const DEFAULT_CONTENT = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Wow, this editor instance exports its content as JSON.",
        },
      ],
    },
  ],
};

export async function handleGetDocument(
  params: z.infer<typeof GetDocumentSchema>["params"],
): Promise<GetDocumentResponse> {

  const query = `
    SELECT
      content_binary,
      v,
      updated_at
    FROM drafts
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1;
  `;

  const client = await pool.connect();

  try {
    const result = await client.query(query, [params.documentId]);

    // — Documento NO existe → devuelve JSON vacío para Tiptap
    if (result.rowCount === 0) {
      return {
        success: true,
        message: "New document",
        command: "get_document",
        data: {
          documentId: params.documentId,
          format: "json",
          content: DEFAULT_CONTENT,
          isNew: true,
        },
      };
    }

    // — Documento existe → devuelve BYTEA como base64 para el cliente
    const row = result.rows[0];

    return {
      success: true,
      message: "Document found",
      command: "get_document",
      data: {
        documentId: params.documentId,
        format: "binary",
        content: row.content_binary as Uint8Array,
        isNew: false,
      },
    };

  } catch (error) {
    console.error("Error obteniendo draft:", error);
    throw error;
  } finally {
    client.release();
  }
}