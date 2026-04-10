import { encode, decode } from "@msgpack/msgpack";

type EditorFrame = {
  command: string;
  params?: Record<string, unknown> & { binario?: Uint8Array };
};

export const useEditorStore = defineStore("editor", () => {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const messages = ref<EditorFrame[]>([]);

const { status, send: wsSend, open, close } = useWebSocket(
  `${protocol}://${location.host}/api/editor/ws`,
  {
    immediate: false,
    autoReconnect: true,
    onConnected: (ws) => {
      ws.binaryType = "arraybuffer";
    },
    onMessage: (_, event) => {
      messages.value.push(decode(new Uint8Array(event.data)) as EditorFrame);
    },
  },
);

function send(cmd: EditorFrame) {
  const encoded = encode(cmd);
  wsSend(encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength), true); // ← fix 3: slice exacto
}

  return { status, messages, connect: open, disconnect: close, send };
});
