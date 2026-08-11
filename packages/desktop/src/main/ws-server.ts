import { WebSocketServer, type WebSocket } from "ws";
import type { NavAction, WsClientMessage, WsServerMessage } from "@coosy/shared";
import { SOURCES } from "./sources/registry.js";
import type { SourceHost } from "./source-host.js";
import { authorizeHello } from "./pairing.js";

export interface WsServerDeps {
  getSourceHost: () => SourceHost | null;
  onToast: (payload: { message: string; ok: boolean }) => void;
  onNav: (action: NavAction) => void;
}

export interface WsServer {
  port: number;
  broadcast: (message: WsServerMessage) => void;
  close: () => Promise<void>;
}

const DEFAULT_PORT = 17832;
const authorized = new WeakSet<WebSocket>();

/**
 * Phone WebSocket server — SOURCE-AGNOSTIC.
 * Looks up active MediaSource and dispatches handleCommand.
 * No if (source === 'netflix') branching allowed here.
 */
export async function startWsServer(deps: WsServerDeps): Promise<WsServer> {
  const port = Number(process.env.COOSY_WS_PORT ?? DEFAULT_PORT);
  const clients = new Set<WebSocket>();

  const wss = new WebSocketServer({ port });

  const broadcast = (message: WsServerMessage): void => {
    const raw = JSON.stringify(message);
    for (const socket of clients) {
      if (socket.readyState === socket.OPEN) {
        socket.send(raw);
      }
    }
  };

  wss.on("connection", (socket) => {
    clients.add(socket);
    socket.once("close", () => {
      clients.delete(socket);
      authorized.delete(socket);
    });

    socket.on("message", (raw) => {
      void handleMessage(deps, socket, broadcast, raw.toString());
    });
  });

  await new Promise<void>((resolve, reject) => {
    wss.once("listening", () => resolve());
    wss.once("error", reject);
  });

  console.log(`[ws] listening on :${port}`);

  return {
    port,
    broadcast,
    close: () =>
      new Promise((resolve, reject) => {
        wss.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function handleMessage(
  deps: WsServerDeps,
  socket: WebSocket,
  broadcast: (message: WsServerMessage) => void,
  raw: string,
): Promise<void> {
  let message: WsClientMessage;
  try {
    message = JSON.parse(raw) as WsClientMessage;
  } catch {
    send(socket, { kind: "error", message: "invalid JSON" });
    return;
  }

  if (message.kind === "hello") {
    const auth = authorizeHello({
      clientId: message.clientId,
      pairingCode: message.pairingCode,
    });
    if (!auth.ok) {
      authorized.delete(socket);
      send(socket, { kind: "error", message: auth.reason });
      return;
    }

    authorized.add(socket);
    const host = deps.getSourceHost();
    const active = host?.getActiveSource() ?? null;
    send(socket, {
      kind: "hello-ack",
      sessionId: crypto.randomUUID(),
      activeSourceId: active?.id ?? null,
      capabilities: active?.capabilities ?? null,
    });
    return;
  }

  if (!authorized.has(socket)) {
    send(socket, { kind: "error", message: "not paired — send hello first" });
    return;
  }

  if (message.kind === "command") {
    const host = deps.getSourceHost();
    const activeId = host?.getActiveSourceId();
    if (!activeId) {
      const result = { ok: false as const, reason: "no-active-session" as const };
      send(socket, {
        kind: "command-result",
        requestId: message.requestId,
        result,
      });
      deps.onToast({ message: `${message.command.type} failed`, ok: false });
      broadcast({
        kind: "toast",
        message: `${message.command.type} failed`,
        ok: false,
      });
      return;
    }

    const source = SOURCES[activeId];
    if (!source) {
      send(socket, {
        kind: "command-result",
        requestId: message.requestId,
        result: { ok: false, reason: "unknown" },
      });
      return;
    }

    const result = await source.handleCommand(message.command);
    send(socket, {
      kind: "command-result",
      requestId: message.requestId,
      result,
    });

    const toast = {
      message: result.ok
        ? message.command.type
        : `${message.command.type} failed`,
      ok: result.ok,
    };
    deps.onToast(toast);
    broadcast({ kind: "toast", ...toast });
    return;
  }

  if (message.kind === "nav") {
    deps.onNav(message.action);
    const toast = { message: `nav:${message.action}`, ok: true };
    deps.onToast(toast);
    broadcast({ kind: "toast", ...toast });
  }
}

function send(socket: WebSocket, message: WsServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}
