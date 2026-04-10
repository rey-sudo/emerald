import type { FastifyInstance } from "fastify";
import {
  ClientMessageSchema,
  handleGetDocument,
  handleUpdateDocument,
  type ClientMessage,
} from "./handlers.js";
import { z } from "zod";
import { decode, encode } from "@msgpack/msgpack";

// ── Dispatcher ────────────────────────────────────────────────────────────────

function dispatch(message: ClientMessage) {
  switch (message.command) {
    case "get_document":
      return handleGetDocument(message.params);
    case "update_document":
      return handleUpdateDocument(message.params);
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export async function router(app: FastifyInstance) {
  app.get("/", async () => ({
    status: "ok",
    message: "Fastify WebSocket Server",
    timestamp: new Date().toISOString(),
  }));

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
          console.log("[backend] zod error:", JSON.stringify(z.treeifyError(parsed.error), null, 2));
          socket.send(
            encode({ command: "error", errors: z.treeifyError(parsed.error) }),
          );
          return;
        }

        app.log.info(`Command received: ${parsed.data.command}`);

        const result = await dispatch(parsed.data);

        socket.send(encode({ ...result, timestamp: new Date().toISOString() }));
      } catch (err: any) {
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
