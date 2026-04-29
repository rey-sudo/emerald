import { encode, decode } from "@msgpack/msgpack";

type EditorFrame = {
  command: string;
  params?: Record<string, unknown> & { binario?: Uint8Array };
};

export const useEditorStore = defineStore("editor", () => {
  const messages = ref<EditorFrame[]>([]);
  const message = ref<EditorFrame | null>(null);

  const protocol = import.meta.client
    ? window.location.protocol === "https:"
      ? "wss"
      : "ws"
    : "ws";

  const host = import.meta.client ? window.location.host : "";

  const {
    status,
    send: wsSend,
    open,
    close,
  } = useWebSocket(`${protocol}://${host}/api/editor/ws`, {
    immediate: false,
    autoReconnect: true,
    onConnected: (ws) => {
      ws.binaryType = "arraybuffer";
      console.info("Websocket connected");
    },
    onMessage: (_, event) => {
      console.log(encode(event));
      
      const parsed = decode(new Uint8Array(event.data)) as any;
      console.log(parsed);
      message.value = parsed;
      messages.value.push(parsed);
    },
  });

  function send(cmd: EditorFrame) {
    if (!import.meta.client) return;

    const encoded = encode(cmd);
    return wsSend(
      encoded.buffer.slice(
        encoded.byteOffset,
        encoded.byteOffset + encoded.byteLength,
      ),
      true,
    );
  }

  return { status, message, messages, connect: open, disconnect: close, send };
});
