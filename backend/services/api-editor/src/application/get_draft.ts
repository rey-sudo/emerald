import { z } from "zod";
import { Pool } from "pg";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";

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

export async function handleGetDocument(
  app: FastifyInstance,
  params: z.infer<typeof GetDocumentSchema>["params"],
): Promise<GetDocumentResponse> {
  const client = await pool.connect();

  try {
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

    const result = await client.query(query, [params.documentId]);

    if (result.rowCount === 0) {
      const _DOCUMENTS_QUERY = "SELECT * FROM documents WHERE id = $1";
      const res = await pool.query(_DOCUMENTS_QUERY, [params.documentId]);

      if (res.rows.length === 0) {
        console.log("Document not found", params.documentId);
        throw new Error("Document not found");
      }

      const document = res.rows[0];
      const jsonKey = document["storage_path"].replace(".pdf", ".json");

      const command = new GetObjectCommand({
        Bucket: "documents",
        Key: jsonKey,
      });

      const response = await app.s3.send(command);
      if (!response.Body) {
        throw new Error("No object");
      }

      const jsonString = await response.Body.transformToString();
      const data = JSON.parse(jsonString);
      
      console.log("obtenido")

      return {
        success: true,
        message: "New document",
        command: "get_document",
        data: {
          documentId: params.documentId,
          format: "json",
          content: data,
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
