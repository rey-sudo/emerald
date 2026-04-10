import type { FastifyInstance } from "fastify";
import {
  ClientMessageSchema,
  handleGetDocument,
  handleUpdateDocument,
  type ClientMessage,
} from "./handlers.js";
import { z } from "zod";

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

    socket.on("message", async (rawMsg: any) => {
      const text = rawMsg.toString();

      try {
        const parsed = ClientMessageSchema.safeParse(JSON.parse(text));

        if (!parsed.success) {
          socket.send(
            JSON.stringify({
              type: "error",
              errors: z.treeifyError(parsed.error),
            }),
          );
          return;
        }

        app.log.info(`Command received: ${parsed.data.command}`);

        const result = await dispatch(parsed.data);

        socket.send(
          JSON.stringify({
            ...result,
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (err: any) {
        app.log.error(`Error processing: ${err.message}`);
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Internal server error",
          }),
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
