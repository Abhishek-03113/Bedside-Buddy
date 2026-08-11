import type {
  CommandResult,
  InputCommand,
  RemoteCommand,
  SourceCapabilities,
  WsClientMessage,
  WsServerMessage,
} from "@coosy/shared";

export type ConnectionStatus = "CONNECTED" | "CONNECTING" | "DISCONNECTED";

const CLIENT_ID_KEY = "coosy.remote.clientId";
const DEFAULT_REMOTE_PORT = 17832;

type HelloHandler = (
  ack: Extract<WsServerMessage, { kind: "hello-ack" }>,
) => void;
type ContextHandler = (
  ctx: Extract<WsServerMessage, { kind: "context" }>,
) => void;
type StatusHandler = (status: ConnectionStatus) => void;
type ErrorHandler = (message: string) => void;
type ToastHandler = (payload: { message: string; ok: boolean }) => void;

/**
 * Source-agnostic WebSocket client — RemoteCommand / nav / pointer+keyboard input.
 */
export interface WsClient {
  readonly status: ConnectionStatus;
  sendCommand(command: RemoteCommand): Promise<CommandResult>;
  /**
   * Send pointer/keyboard input. By default awaits acknowledgement.
   * Use `awaitResult: false` for high-frequency pointer-move/scroll.
   */
  sendInput(
    command: InputCommand,
    opts?: { awaitResult?: boolean },
  ): Promise<CommandResult>;
  sendNav(
    action: Extract<WsClientMessage, { kind: "nav" }>["action"],
  ): Promise<void>;
  setPairingCode(code: string | undefined): void;
  onHello(handler: HelloHandler): void;
  onContext(handler: ContextHandler): void;
  onStatus(handler: StatusHandler): void;
  onError(handler: ErrorHandler): void;
  onToast(handler: ToastHandler): void;
  onClose(handler: () => void): void;
  close(): void;
}

/**
 * LAN http://IP pages are NOT secure contexts on iOS Safari — crypto.randomUUID throws.
 */
export function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* insecure context */
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

export function getOrCreateClientId(
  storage?: Pick<Storage, "getItem" | "setItem">,
): string {
  let store = storage;
  if (!store) {
    try {
      const probe = globalThis.localStorage;
      probe.getItem(CLIENT_ID_KEY);
      store = probe;
    } catch {
      store = memoryStorage();
    }
  }

  try {
    const existing = store.getItem(CLIENT_ID_KEY);
    if (existing && existing.length > 0) return existing;
    const id = randomId();
    store.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

/**
 * Prefer same host/port as the HTTP page (laptop-served UI).
 * Vite dev (`:5174`) defaults to the desktop remote port unless `?ws=` is set.
 */
export function resolveWsUrl(opts: {
  hostname: string;
  search: string;
  protocol?: string;
  port?: string;
}): string {
  const params = new URLSearchParams(opts.search);
  const host = opts.hostname || "localhost";
  const proto = opts.protocol === "https:" ? "wss" : "ws";
  const explicit = params.get("ws");

  if (explicit) {
    if (explicit.startsWith("ws://") || explicit.startsWith("wss://")) {
      return explicit;
    }
    return `${proto}://${host}:${explicit}`;
  }

  const pagePort = opts.port ?? "";
  if (pagePort === "5174" || params.get("dev") === "1") {
    return `${proto}://${host}:${DEFAULT_REMOTE_PORT}`;
  }
  if (pagePort) {
    return `${proto}://${host}:${pagePort}`;
  }
  return `${proto}://${host}:${DEFAULT_REMOTE_PORT}`;
}

export interface CreateWsClientOptions {
  url: string;
  clientId?: string;
  pairingCode?: string;
  /** Delay before reconnect attempts (ms). */
  reconnectDelayMs?: number;
  /** Injected WebSocket constructor for tests. */
  WebSocketImpl?: typeof WebSocket;
}

/**
 * Source-agnostic WebSocket client with pairing + simple reconnect.
 */
export function createWsClient(opts: CreateWsClientOptions | string): WsClient {
  const options: CreateWsClientOptions =
    typeof opts === "string" ? { url: opts } : opts;
  const WebSocketImpl = options.WebSocketImpl ?? WebSocket;
  const reconnectDelayMs = options.reconnectDelayMs ?? 1500;
  const clientId = options.clientId ?? getOrCreateClientId();

  let pairingCode = options.pairingCode;
  let socket: WebSocket = new WebSocketImpl(options.url);
  let status: ConnectionStatus = "CONNECTING";
  let intentionalClose = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  let helloHandler: HelloHandler | null = null;
  let contextHandler: ContextHandler | null = null;
  let statusHandler: StatusHandler | null = null;
  let errorHandler: ErrorHandler | null = null;
  let toastHandler: ToastHandler | null = null;
  let closeHandler: (() => void) | null = null;

  const pending = new Map<
    string,
    {
      resolve: (result: CommandResult) => void;
      reject: (err: Error) => void;
    }
  >();

  const setStatus = (next: ConnectionStatus) => {
    status = next;
    statusHandler?.(next);
  };

  const rejectPending = (reason: string) => {
    for (const [, entry] of pending) {
      entry.reject(new Error(reason));
    }
    pending.clear();
  };

  const attach = (ws: WebSocket) => {
    ws.addEventListener("open", () => {
      setStatus("CONNECTING");
      send({
        kind: "hello",
        clientId,
        ...(pairingCode ? { pairingCode } : {}),
      });
    });

    ws.addEventListener("message", (event) => {
      let message: WsServerMessage;
      try {
        message = JSON.parse(String(event.data)) as WsServerMessage;
      } catch {
        return;
      }

      if (message.kind === "hello-ack") {
        setStatus("CONNECTED");
        helloHandler?.(message);
        return;
      }
      if (message.kind === "context") {
        contextHandler?.(message);
        return;
      }
      if (message.kind === "command-result") {
        const entry = pending.get(message.requestId);
        if (entry) {
          pending.delete(message.requestId);
          entry.resolve(message.result);
        }
        return;
      }
      if (message.kind === "toast") {
        toastHandler?.(message);
        return;
      }
      if (message.kind === "error") {
        errorHandler?.(message.message);
        if (message.message.includes("pairing")) {
          // Keep the socket; UI should collect a pairing code.
          setStatus("DISCONNECTED");
        }
      }
    });

    ws.addEventListener("close", () => {
      rejectPending("connection closed");
      closeHandler?.();
      if (intentionalClose) {
        setStatus("DISCONNECTED");
        return;
      }
      setStatus("CONNECTING");
      reconnectTimer = setTimeout(() => {
        socket = new WebSocketImpl(options.url);
        attach(socket);
      }, reconnectDelayMs);
    });

    ws.addEventListener("error", () => {
      // close handler drives reconnect / status
    });
  };

  attach(socket);

  function send(message: WsClientMessage): void {
    if (socket.readyState === WebSocketImpl.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  return {
    get status() {
      return status;
    },
    async sendCommand(command) {
      if (socket.readyState !== WebSocketImpl.OPEN || status !== "CONNECTED") {
        return { ok: false, reason: "no-active-session" };
      }
      const requestId = randomId();
      return new Promise<CommandResult>((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        send({ kind: "command", requestId, command });
      });
    },
    async sendInput(command, opts) {
      if (socket.readyState !== WebSocketImpl.OPEN || status !== "CONNECTED") {
        return { ok: false, reason: "no-active-session" };
      }
      const requestId = randomId();
      const message: Extract<WsClientMessage, { kind: "input" }> = {
        kind: "input",
        requestId,
        command,
      };

      if (opts?.awaitResult === false) {
        send(message);
        return { ok: true };
      }

      return new Promise<CommandResult>((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        send(message);
      });
    },
    async sendNav(action) {
      if (socket.readyState !== WebSocketImpl.OPEN || status !== "CONNECTED") {
        throw new Error("Not connected");
      }
      send({
        kind: "nav",
        requestId: randomId(),
        action,
      });
    },
    setPairingCode(code) {
      pairingCode = code?.trim() || undefined;
      if (socket.readyState === WebSocketImpl.OPEN) {
        send({
          kind: "hello",
          clientId,
          ...(pairingCode ? { pairingCode } : {}),
        });
      } else if (socket.readyState === WebSocketImpl.CLOSED) {
        intentionalClose = false;
        setStatus("CONNECTING");
        socket = new WebSocketImpl(options.url);
        attach(socket);
      }
    },
    onHello(handler) {
      helloHandler = handler;
    },
    onContext(handler) {
      contextHandler = handler;
    },
    onStatus(handler) {
      statusHandler = handler;
      handler(status);
    },
    onError(handler) {
      errorHandler = handler;
    },
    onToast(handler) {
      toastHandler = handler;
    },
    onClose(handler) {
      closeHandler = handler;
    },
    close() {
      intentionalClose = true;
      if (reconnectTimer != null) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      closeHandler = null;
      rejectPending("client closed");
      setStatus("DISCONNECTED");
      socket.close();
    },
  };
}

export type { SourceCapabilities };
