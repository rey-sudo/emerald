import type { FastifyInstance } from "fastify";
import { decode, encode } from "@msgpack/msgpack";
import { handleUpdateDocument, UpdateDocumentSchema } from "./update_draft.js";
import { GetDocumentSchema, handleGetDocument } from "./get_draft.js";
import { z } from "zod";
import { getFoldersHandler } from "./get-folders.js";

export const ClientMessageSchema = z.discriminatedUnion("command", [
  GetDocumentSchema,
  UpdateDocumentSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ── Dispatcher ────────────────────────────────────────────────────────────────

function dispatch(app: FastifyInstance, message: ClientMessage) {
  switch (message.command) {
    case "get_document":
      return handleGetDocument(app, message.params);
    case "update_document":
      return handleUpdateDocument(app, message.params);
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export async function router(app: FastifyInstance) {
  app.get("/", async () => ({
    status: "ok",
    message: "Fastify WebSocket Server",
    timestamp: new Date().toISOString(),
  }));

  app.get("/get-folders", getFoldersHandler);

  app.get("/ws", { websocket: true }, (socket: any, _req: any) => {
    app.clients.add(socket);
    app.log.info(`Client connected: ${app.clients.size}`);

    //===================================================================

    socket.on("message", async (rawMsg: Buffer, isBinary: boolean) => {
      try {
        console.log(
          "[backend] recibido - isBinary:",
          isBinary,
          "bytes:",
          rawMsg.byteLength,
        );

        const parsed = ClientMessageSchema.safeParse(decode(rawMsg));
        if (!parsed.success) {
          console.log(
            "[backend] zod error:",
            JSON.stringify(z.treeifyError(parsed.error), null, 2),
          );
          socket.send(
            encode({ command: "error", errors: z.treeifyError(parsed.error) }),
          );
          return;
        }

        app.log.info(`Command received: ${parsed.data.command}`);

        const result = await dispatch(app, parsed.data);

        socket.send(encode({ ...result, timestamp: new Date().toISOString() }));
      } catch (err: any) {
        //TODO: FILTER ERRORS
        app.log.error(`Error processing: ${err.message}`);
        socket.send(
          encode({ command: "error", message: "Internal server error" }),
        );
      }
    });

    //===================================================================

    socket.on("close", () => {
      app.clients.delete(socket);
      app.log.info(`Disconnected client: ${app.clients.size}`);
    });

    socket.on("error", (err: any) => {
      app.log.error(`Error WebSocket: ${err.message}`);
      app.clients.delete(socket);
    });
  });
}
