import type {
  RemoteCommand,
  SourceCapabilities,
  WsClientMessage,
  WsServerMessage,
} from "@coosy/shared";

type HelloHandler = (
  ack: Extract<WsServerMessage, { kind: "hello-ack" }>,
) => void;
type ContextHandler = (
  ctx: Extract<WsServerMessage, { kind: "context" }>,
) => void;

/**
 * Source-agnostic WebSocket client — only sends RemoteCommand / nav.
 */
export interface WsClient {
  sendCommand(command: RemoteCommand): Promise<void>;
  sendNav(
    action: Extract<WsClientMessage, { kind: "nav" }>["action"],
  ): Promise<void>;
  onHello(handler: HelloHandler): void;
  onContext(handler: ContextHandler): void;
  onClose(handler: () => void): void;
  close(): void;
}

export function createWsClient(url: string): WsClient {
  let socket = new WebSocket(url);
  let helloHandler: HelloHandler | null = null;
  let contextHandler: ContextHandler | null = null;
  let closeHandler: (() => void) | null = null;
  let reconnectTimer: number | null = null;

  const attach = (ws: WebSocket) => {
    ws.addEventListener("open", () => {
      send({
        kind: "hello",
        clientId: crypto.randomUUID(),
      });
    });

    ws.addEventListener("message", (event) => {
      let message: WsServerMessage;
      try {
        message = JSON.parse(String(event.data)) as WsServerMessage;
      } catch {
        return;
      }
      if (message.kind === "hello-ack") helloHandler?.(message);
      if (message.kind === "context") contextHandler?.(message);
    });

    ws.addEventListener("close", () => {
      closeHandler?.();
      reconnectTimer = window.setTimeout(() => {
        socket = new WebSocket(url);
        attach(socket);
      }, 1500);
    });
  };

  attach(socket);

  function send(message: WsClientMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  return {
    async sendCommand(command) {
      send({
        kind: "command",
        requestId: crypto.randomUUID(),
        command,
      });
    },
    async sendNav(action) {
      send({
        kind: "nav",
        requestId: crypto.randomUUID(),
        action,
      });
    },
    onHello(handler) {
      helloHandler = handler;
    },
    onContext(handler) {
      contextHandler = handler;
    },
    onClose(handler) {
      closeHandler = handler;
    },
    close() {
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      closeHandler = null;
      socket.close();
    },
  };
}

export type { SourceCapabilities };
