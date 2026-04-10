import { encode, decode } from "@msgpack/msgpack";

type EditorFrame = {
  command: string;
  params?: Record<string, unknown> & { binario?: Uint8Array };
};

export const useEditorStore = defineStore("editor", () => {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const messages = ref<EditorFrame[]>([]);
  const message = ref<EditorFrame | null>(null);

  const {
    status,
    send: wsSend,
    open,
    close,
  } = useWebSocket(`${protocol}://${location.host}/api/editor/ws`, {
    immediate: false,
    autoReconnect: true,
    onConnected: (ws) => {
      ws.binaryType = "arraybuffer";
    },
    onMessage: (_, event) => {
      console.log(event.data)
      const parsed = decode(new Uint8Array(event.data)) as any;
      console.log(parsed);
      message.value = parsed;
      messages.value.push(parsed);
    },
  });

  function send(cmd: EditorFrame) {
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
