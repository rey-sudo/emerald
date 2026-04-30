// Emerald
// Copyright (C) 2026 Juan José Caballero Rey - https://github.com/rey-sudo
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";

export const GetDocumentSchema = z.object({
  command: z.literal("get_document"),
  params: z.object({ documentId: z.string() }),
});

export interface GetDocumentResponse {
  success: boolean;
  command: "get_document";
  message: string;
  data: {
    documentId: string;
    content: any;
    chunks: any;
  };
}

export async function handleGetDocument(
  app: FastifyInstance,
  params: any,
): Promise<GetDocumentResponse> {
  const { s3, redis, pg_pool, log } = app;

  // 1. Params validation ------------------------------------------------------------------------------------------------

  const result = GetDocumentSchema.shape.params.safeParse(params);
  if (!result.success) {
    const errorTree = z.treeifyError(result.error);

    log.error({ errors: errorTree }, "Invalid params error");
    throw new Error("Invalid request parameters");
  }

  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: Replace with dynamic user context from request
  const documentId = params.documentId;
  const s3Bucket = "documents";
  const binaryKey = `doc:${documentId}:state`;
  const streamKey = `doc:${documentId}:chunks`;
  const expireValue = 3600

  try {
    // 2. Check document ownership. ----------------------------------------------------------------------------------------

    const documentResult = await pg_pool.query(
      "SELECT * FROM documents WHERE id = $1 AND user_id = $2",
      [documentId, userId],
    );

    // The original document does not exist.
    if (documentResult.rows.length === 0) {
      log.warn(`Document not found in database.`);
      throw new Error("Document not found");
    }

    // 3. Get the draft binary from Redis. ---------------------------------------------------------------------------------

    const originalDocument = documentResult.rows[0];
    const s3BinaryKey = originalDocument.storage_path.replace(/\.pdf$/, ".yjs");

    let baseBinary: Uint8Array | null = await redis.getBuffer(binaryKey);
    let fromS3 = false;

    // 4. Fallback get the binary from S3. ----------------------------------------------------------------------------------

    if (!baseBinary) {
      const s3Response = await s3.send(
        new GetObjectCommand({
          Bucket: s3Bucket,
          Key: s3BinaryKey,
        }),
      );

      if (!s3Response.Body) {
        throw new Error("No S3 object");
      }

      const byteArray = await s3Response.Body.transformToByteArray();
      if (byteArray.length > 0) {
        baseBinary = byteArray;
        fromS3 = true;

        await redis.setex(
          binaryKey,
          expireValue,
          Buffer.from(
            baseBinary.buffer,
            baseBinary.byteOffset,
            baseBinary.byteLength,
          ),
        );
      }
    }

    if (!baseBinary) {
      throw new Error("Failed to retrieve binary from Redis and S3");
    }

    // 5. Find hot chunks stream. -------------------------------------------------------------------------------------------

    const content = new Uint8Array(baseBinary);

    const streamEntries = await redis.xrangeBuffer(streamKey, "-", "+");
    const chunks = streamEntries.map(([id, fields]) => {
      return {
        id: id.toString(),
        data: new Uint8Array(fields[1]),
      };
    });

    console.log(chunks);

    return {
      success: true,
      command: "get_document",
      message: "success",
      data: {
        documentId,
        content,
        chunks,
      },
    };
  } catch (error) {
    log.error(error);
    throw error;
  }
}
