import { encode, decode } from "@msgpack/msgpack";

type WsMessage = {
  command: string;
  success: boolean;
  data: any;
  timestamp: Date;
};

type WsCommand = {
  command: string;
  params: any;
};

export const useEditorStore = defineStore("editor", () => {
  const allMessages = ref<WsMessage[]>([]);
  const message = ref<WsMessage | null>(null);

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
      const parsed = decode(event.data) as any;
      message.value = parsed;
      allMessages.value.push(parsed);

      console.log(parsed);
    },
  });

  function send(cmd: WsCommand) {
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

  return {
    status,
    message,
    allMessages,
    connect: open,
    disconnect: close,
    send,
  };
});
