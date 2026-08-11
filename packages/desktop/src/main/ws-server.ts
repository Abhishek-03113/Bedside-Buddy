import { WebSocketServer, type WebSocket } from "ws";
import { SOURCES } from "./sources/registry.js";
import type { SourceHost } from "./source-host.js";
import type { WsClientMessage, WsServerMessage } from "@coosy/shared";

export interface WsServerDeps {
  getSourceHost: () => SourceHost | null;
}

const DEFAULT_PORT = 17832;

/**
 * Phone WebSocket server — SOURCE-AGNOSTIC.
 * Looks up active MediaSource and dispatches handleCommand.
 * No if (source === 'netflix') branching allowed here.
 */
export async function startWsServer(deps: WsServerDeps): Promise<number> {
  const port = Number(process.env.COOSY_WS_PORT ?? DEFAULT_PORT);

  const wss = new WebSocketServer({ port });

  wss.on("connection", (socket) => {
    const host = deps.getSourceHost();
    const active = host?.getActiveSource() ?? null;

    send(socket, {
      kind: "hello-ack",
      sessionId: crypto.randomUUID(),
      activeSourceId: active?.id ?? null,
      capabilities: active?.capabilities ?? null,
    });

    socket.on("message", (raw) => {
      void handleMessage(deps, socket, raw.toString());
    });
  });

  await new Promise<void>((resolve, reject) => {
    wss.once("listening", () => resolve());
    wss.once("error", reject);
  });

  console.log(`[ws] listening on :${port}`);
  return port;
}

async function handleMessage(
  deps: WsServerDeps,
  socket: WebSocket,
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

  if (message.kind === "command") {
    const host = deps.getSourceHost();
    const activeId = host?.getActiveSourceId();
    if (!activeId) {
      send(socket, {
        kind: "command-result",
        requestId: message.requestId,
        result: { ok: false, reason: "no-active-session" },
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
    send(socket, {
      kind: "toast",
      message: result.ok
        ? message.command.type
        : `${message.command.type} failed`,
      ok: result.ok,
    });
    return;
  }

  if (message.kind === "nav") {
    // Launcher navigation is handled by renderer via IPC in a later phase.
    // Stub ack for scaffolding.
    send(socket, {
      kind: "toast",
      message: `nav:${message.action}`,
      ok: true,
    });
  }
}

function send(socket: WebSocket, message: WsServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}
