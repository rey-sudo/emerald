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
import { AppError } from "./error.js";
import * as Y from "yjs";
import Redis from "ioredis";

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

export interface UpdateDocumentResponse {
  success: boolean;
  command: "update_document";
  message: string;
  data: {
    draftId: string;
  };
}

export interface OutboxPayload {
  draftId: string;
  chunkId: null | string;
  chunk: null | string;
  source: string;
  created_at: number;
}

// PROCESS CHUNK -------------------------------------------------------------------------------------------------------
/**
 *
 * @param redis
 * @param draftId
 * @param deltaBinary
 * @param binaryKey
 * @param streamKey
 * @param expireValue
 * @param timestamp
 * @returns
 */
async function processChunk(
  log: any,
  redis: Redis.Redis,
  draftId: string,
  deltaBinary: Uint8Array<ArrayBuffer>,
  binaryKey: string,
  streamKey: string,
  expireValue: number,
  timestamp: number,
) {
  const retryConfig = {
    retries: 5,
    onFailedAttempt: (error: any) => {
      log.warn(`Retry failed: ${error.error.message}`);
    },
  };

  const outboxPayload: OutboxPayload = {
    draftId,
    chunkId: null,
    chunk: null,
    source: "factory-api-server",
    created_at: timestamp,
  };

  let response = {
    success: false,
    outboxPayload,
  };

  try {
    await pRetry(async (attemptNumber) => {
      // 1. Buffer convertion
      const updateBuffer = Buffer.from(
        deltaBinary.buffer,
        deltaBinary.byteOffset,
        deltaBinary.byteLength,
      );

      if (updateBuffer.length === 0) {
        throw new AbortError("Empty buffer: unrecoverable error");
      }

      outboxPayload.chunk = updateBuffer.toString("base64");

      // 2. Operación en Redis -----------------------------------------------------------------------------------------

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

      // 3. Pulsar publication ------------------------------------
      outboxPayload.chunkId = chunkId as string;

      try {
        const pulsarPayload = Buffer.from(JSON.stringify(outboxPayload));
        const published = await pulsarProducer.send({
          data: pulsarPayload,
          partitionKey: draftId,
        });

        console.log(published.toString());
      } catch (pulsarError) {
        log.error(pulsarError);
        throw pulsarError;
      }
    }, retryConfig);

    response.success = true;
  } catch (error) {
    response.success = false;
  } finally {
    return response;
  }
}

// UPDATE DOCUMENT HANDLER ---------------------------------------------------------------------------------------------

export async function handleUpdateDocument(
  app: FastifyInstance,
  params: any,
): Promise<UpdateDocumentResponse> {
  const { redis, pg_pool, log } = app;

  // 1. Params validation. ---------------------------------------------------------------------------------------------

  const result = UpdateDocumentSchema.shape.params.safeParse(params);
  if (!result.success) {
    const errorTree = z.treeifyError(result.error);
    log.error({ errors: errorTree }, "Invalid params error");

    throw new AppError("Invalid request parameters", false);
  }

  const { binario: deltaBinary } = result.data;

  const timestamp = Date.now();
  const userId = "019d2612-a01d-734c-ab63-917106f31187"; // TODO: Replace with dynamic user context from request
  const draftId = params.documentId;
  const binaryKey = `doc:${draftId}:state`;
  const streamKey = `doc:${draftId}:chunks`;
  const expireValue = 3600;

  try {
    // 2. Check authorization. -----------------------------------------------------------------------------------------

    const documentResult = await pg_pool.query(
      "SELECT * FROM documents WHERE id = $1 AND user_id = $2",
      [draftId, userId],
    );

    // The original document does not exist
    if (documentResult.rows.length === 0) {
      log.warn(`Document not found in database.`);
      throw new AppError("Document not found", false);
    }

    // 3. Process diff chunk -------------------------------------------------------------------------------------------

    const { success, outboxPayload } = await processChunk(
      log,
      redis,
      draftId,
      deltaBinary,
      binaryKey,
      streamKey,
      expireValue,
      timestamp,
    );

    console.log(success, outboxPayload);

    // 4. Fallback: Persist in database --------------------------------------------------------------------------------

    if (success === false) {
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
  } catch (err) {
    log.error(err);
    if (err instanceof AppError) {
      throw new Error("Errooor");

      //outboxPayload
    } else {
      throw new Error("Errooor");
    }
  }
}
