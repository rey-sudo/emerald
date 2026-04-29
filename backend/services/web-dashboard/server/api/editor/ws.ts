export default defineWebSocketHandler({
  open(peer) {
    const ws = new WebSocket("ws://localhost:8002/api/editor/ws");
    ws.binaryType = "arraybuffer";

    ws.onmessage = (event) => peer.send(event.data);
    ws.onclose = (event) => {
      const code = event.code >= 1000 ? event.code : 1000;
      peer.close(code, event.reason || "upstream closed");
    };
    ws.onerror = () => peer.close(1011, "Upstream error");

    (peer as any)._upstream = ws;
  },

  message(peer, message) {
    const upstream = (peer as any)._upstream as WebSocket;
    console.log(
      "[proxy] rawData type:",
      typeof message.rawData,
      message.rawData?.constructor?.name,
    );
    console.log("[proxy] upstream readyState:", upstream?.readyState);

    if (upstream?.readyState !== WebSocket.OPEN) return;
    upstream.send(message.rawData as ArrayBuffer);
  },

  close(peer, event) {
    const code = (event?.code ?? 0) >= 1000 ? event.code! : 1000;
    ((peer as any)._upstream as WebSocket)?.close(code, event?.reason);
  },

  error(peer, error) {
    ((peer as any)._upstream as WebSocket)?.close(1011, error.message);
  },
});
