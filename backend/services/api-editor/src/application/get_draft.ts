import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { pool } from "../infrastructure/postgres/db.js";
import type { FastifyInstance } from "fastify";

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

  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: Replace with dynamic user context from request

  try {
    // 1. Check for an existing working draft in the database.
    const draftQuery = `
      SELECT content_binary, updated_at, v
      FROM drafts
      WHERE id = $1
        AND user_id = $2 
        AND deleted_at IS NULL
      LIMIT 1;
    `;

    const draftResult = await client.query(draftQuery, [
      params.documentId,
      userId,
    ]);

    // --- CASE 1: IF DRAFT NOT EXISTS ---
    if (draftResult.rowCount === 0) {
      // Obtain the original document
      const documentResult = await client.query(
        "SELECT * FROM documents WHERE id = $1 AND user_id = $2",
        [params.documentId, userId],
      );

      // The original document does not exist
      if (documentResult.rows.length === 0) {
        app.log.warn(`Document ${params.documentId} not found in database.`);
        throw new Error("Document not found");
      }

      const document = documentResult.rows[0];

      // Get the original document from S3 storage
      const jsonKey = document.storage_path.replace(".pdf", ".json");
      const command = new GetObjectCommand({
        Bucket: "documents",
        Key: jsonKey,
      });

      const s3Response = await app.s3.send(command);
      if (!s3Response.Body) {
        throw new Error("No object");
      }

      const jsonString = await s3Response.Body.transformToString();
      const jsonDocument = JSON.parse(jsonString);

      return {
        success: true,
        message: "New document",
        command: "get_document",
        data: {
          documentId: params.documentId,
          format: "json",
          content: jsonDocument,
          isNew: true,
        },
      };
    }

    // --- CASE 2: IF DRAFT EXISTS ---
    const draft = draftResult.rows[0];
    const binaryDocument = new Uint8Array(draft.content_binary);

    return {
      success: true,
      message: "Document found",
      command: "get_document",
      data: {
        documentId: params.documentId,
        format: "binary",
        content: binaryDocument,
        isNew: false,
      },
    };
  } catch (error) {
    app.log.error(error);
    throw error;
  } finally {
    client.release();
  }
}
