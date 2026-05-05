import { defineWebSocketHandler } from "h3";
import { WebSocket } from "ws";

export default defineWebSocketHandler({
  open(peer) {
    const request = (peer as any).request ?? (peer as any)._request;
    const headers: Record<string, string> = {};

    if (request?.headers) {
      for (const key of ["cookie", "authorization", "x-forwarded-for"]) {
        const val = request.headers[key];
        if (val) headers[key] = val;
      }
    }

    const upstream = new WebSocket("ws://localhost:8002/api/editor/ws", {
      headers,
    });

    const messageQueue: Buffer[] = [];
    (peer as any)._upstream = upstream;
    (peer as any)._messageQueue = messageQueue;

    upstream.on("open", () => {
      for (const msg of messageQueue) upstream.send(msg);
      messageQueue.length = 0;
    });

    upstream.on("message", (data: Buffer, isBinary: boolean) => {
      // Reenviar al cliente manteniendo el binario intacto
      peer.send(isBinary ? data : data.toString());
    });

    upstream.on("close", (code, reason) => {
      peer.close(code, reason.toString());
    });

    upstream.on("error", (err) => {
      console.error("[WS upstream error]", err.message);
      peer.close(1011, "Upstream error");
    });
  },

  async message(peer, message) {
    const upstream: WebSocket = (peer as any)._upstream;
    const queue: Buffer[] = (peer as any)._messageQueue ?? [];

    const buffer = (message as any)._data ?? (message as any).rawData;

    if (!upstream || upstream.readyState === WebSocket.CONNECTING) {
      queue.push(buffer);
      return;
    }

    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(buffer);
    }
  },

  close(peer, details) {
    const upstream: WebSocket = (peer as any)._upstream;
    if (upstream && upstream.readyState < WebSocket.CLOSING) {
      upstream.close(details?.code ?? 1000, details?.reason ?? "Client closed");
    }
  },

  error(peer, error) {
    console.error("[WS peer error]", error);
    const upstream: WebSocket = (peer as any)._upstream;
    upstream?.close(1011, "Peer error");
  },
});
