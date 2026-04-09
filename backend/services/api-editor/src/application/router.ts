import type { FastifyInstance } from "fastify";

export async function router(app: FastifyInstance) {
  app.get("/", async () => ({
    status: "ok",
    message: "Fastify WebSocket Server",
    timestamp: new Date().toISOString(),
  }));

  //====================================================================================

  app.get("/ws", { websocket: true }, (socket: any, req: any) => {
    app.clients.add(socket);
    app.log.info(`Cliente conectado · total: ${app.clients.size}`);

    socket.on("message", (rawMsg: any) => {
      const text = rawMsg.toString();
      const message = JSON.parse(text)

      app.log.info(`Mensaje recibido: ${message.command}`);

      const response = JSON.stringify({
        type: "message",
        echo: text,
        message: `Eco: ${text}`,
        timestamp: new Date().toISOString(),
      });

      socket.send(response);
    });

    socket.on("close", () => {
      app.clients.delete(socket);
      app.log.info(`Cliente desconectado · total: ${app.clients.size}`);
    });

    socket.on("error", (err: any) => {
      app.log.error(`Error WebSocket: ${err.message}`);
      app.clients.delete(socket);
    });
  });
}
