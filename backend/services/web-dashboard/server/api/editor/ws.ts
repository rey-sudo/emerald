export default defineWebSocketHandler({
  open(peer) {
    const ws = new WebSocket("ws://localhost:8002/api/editor/ws");
    ws.binaryType = "arraybuffer";

    (peer as any)._buffer = [];
    (peer as any)._upstream = ws;

    ws.onopen = () => {
      const buffer = (peer as any)._buffer;
      for (const msg of buffer) ws.send(msg);
      (peer as any)._buffer = [];
    };

    ws.onmessage = (event) => {
      peer.send(event.data);
    };

    ws.onclose = (event) => {
      const code = event.code >= 1000 ? event.code : 1000;
      peer.close(code, event.reason || "upstream closed");
    };

    ws.onerror = () => {
      peer.close(1011, "Upstream error");
    };
  },

  message(peer, message) {
    const upstream = (peer as any)._upstream as WebSocket;
    const data = message.rawData;

    if (!upstream) return;

    if (upstream.readyState !== WebSocket.OPEN) {
      const buf = (peer as any)._buffer;

      if (buf.length >= 1000) {
        peer.close(1013, "Backpressure");
        return;
      }

      buf.push(data);
      return;
    }

    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      upstream.send(data);
    }
  },

  close(peer, event) {
    const upstream = (peer as any)._upstream as WebSocket;

    const code = (event?.code ?? 0) >= 1000 ? event.code! : 1000;
    upstream?.close(code, event?.reason);

    delete (peer as any)._upstream;
    delete (peer as any)._buffer;
  },

  error(peer, error) {
    ((peer as any)._upstream as WebSocket)?.close(1011, error.message);
  },
});