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
import type { FastifyInstance } from "fastify";
import { pulsarProducer } from "../app.js";
import pRetry, { AbortError } from "p-retry";
import * as Y from "yjs";

export const UpdateDocumentSchema = z.object({
  command: z.literal("update_document"),
  params: z.object({
    documentId: z.uuid(),
    binario: z.instanceof(Uint8Array).refine(
      (data) => {
        try {
          const doc = new Y.Doc();
          Y.applyUpdate(doc, data);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid Yjs binary" },
    ),
  }),
});

export interface GetDocumentResponse {
  success: boolean;
  command: "update_document";
  message: string;
  data: {
    draftId: string;
  };
}

export async function handleUpdateDocument(app: FastifyInstance, params: any) {
  const { redis, pg_pool, log } = app;

  // 1. Params validation. -----------------------------------------------------------------------------------------------

  const result = UpdateDocumentSchema.shape.params.safeParse(params);
  if (!result.success) {
    const errorTree = z.treeifyError(result.error);

    log.error({ errors: errorTree }, "Invalid params error");
    throw new Error("Invalid request parameters");
  }

  const timestamp = Date.now();
  const draftId = params.documentId;
  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: Replace with dynamic user context from request
  const deltaBinary = params.binario;
  const binaryKey = `doc:${draftId}:state`;
  const streamKey = `doc:${draftId}:chunks`;
  const expireValue = 3600;

  try {
    // 2. Check document authorization. ------------------------------------------------------------------------------------

    const documentResult = await pg_pool.query(
      "SELECT * FROM documents WHERE id = $1 AND user_id = $2",
      [draftId, userId],
    );

    // The original document does not exist
    if (documentResult.rows.length === 0) {
      log.warn(`Document not found in database.`);
      throw new Error("Document not found");
    }

    // 3. Persist in the stream and Pulsar ------------------------------------------------------------------------------------------

    let updateBuffer = null;

    const outboxPayload = {
      draftId,
      chunkId: null,
      chunk: updateBuffer,
      source: "factory-api-server",
      created_at: timestamp,
    };

    const processChunk = async () => {
      // Envolvemos la lógica en pRetry
      return await pRetry(
        async (attemptNumber) => {
          updateBuffer = Buffer.from(
            deltaBinary.buffer,
            deltaBinary.byteOffset,
            deltaBinary.byteLength,
          );

          if (updateBuffer.length === 0) {
            throw new AbortError(
              "Buffer vacío: Error irrecuperable en los datos del chunk.",
            );
          }

          // 2. Operación en Redis
          const pipeline = redis.pipeline();

          pipeline.xadd(streamKey, "*", "data", updateBuffer);
          pipeline.expire(streamKey, expireValue);
          pipeline.expire(binaryKey, expireValue);

          const results = await pipeline.exec();
          if (!results) {
            throw new Error(
              "Redis pipeline no retornó resultados (posible desconexión).",
            );
          }

          const [err, chunkId] = results[0];
          if (err) throw new Error(`Redis XADD falló: ${err.message}`);

          // 3. Operación en Pulsar
          try {
            const pulsarPayload = Buffer.from(JSON.stringify(outboxPayload));
            const final = await pulsarProducer.send({
              data: pulsarPayload,
              partitionKey: draftId,
            });

            return { chunkId, pulsarMsgId: final.toString() };
          } catch (pulsarError) {
            throw pulsarError;
          }
        },
        {
          retries: 5,
          onFailedAttempt: (error) => {
            console.warn(`Intento fallido: ${error.error.message}`);
          },
        },
      );
    };

    try {
      const { chunkId, pulsarMsgId } = await processChunk();
      console.log(
        `✅ Chunk ${chunkId} procesado con éxito. Pulsar: ${pulsarMsgId}`,
      );
    } catch (error) {
      console.error("❌ Fallo definitivo tras todos los reintentos:", error);

      //OUTBOX EVENT
    }

    return {
      success: true,
      command: "update_document",
      message: "success",
      data: {
        draftId,
      },
    };
  } catch (error) {
    log.error(error);
    throw error;
  }
}
