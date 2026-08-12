import { createServer, type Server as HttpServer } from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import type {
  NavAction,
  RemoteSourceSummary,
  SourceCapabilities,
  WsClientMessage,
  WsServerMessage,
} from "@coosy/shared";
import { parseInputCommand } from "@coosy/shared";
import { listSources, SOURCES } from "./sources/registry.js";
import type { SourceHost } from "./source-host.js";
import { authorizeHello } from "./pairing.js";
import { handleRemoteStaticRequest } from "./remote-static.js";

export interface RemoteServerDeps {
  getSourceHost: () => SourceHost | null;
  onToast: (payload: { message: string; ok: boolean }) => void;
  onNav: (action: NavAction) => void;
  /** Built remote UI directory; null → HTTP returns 503 for UI (WS still works). */
  staticRoot: string | null;
  host?: string;
  port?: number;
}

export interface RemoteServer {
  port: number;
  host: string;
  broadcast: (message: WsServerMessage) => void;
  close: () => Promise<void>;
}

export const DEFAULT_REMOTE_PORT = 17832;

const authorized = new WeakSet<WebSocket>();

export function resolveRemotePort(envPort = process.env.COOSY_WS_PORT): number {
  const n = Number(envPort ?? DEFAULT_REMOTE_PORT);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_REMOTE_PORT;
}

/**
 * Prefer packaged/copied remote assets next to the desktop build output.
 * Falls back to the monorepo remote dist during local development.
 */
export function resolveRemoteStaticRoot(opts: {
  desktopOutDir: string;
  candidates?: string[];
}): string | null {
  const candidates = opts.candidates ?? [
    join(opts.desktopOutDir, "remote"),
    join(opts.desktopOutDir, "..", "..", "remote", "dist"),
    join(opts.desktopOutDir, "..", "remote", "dist"),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html"))) return candidate;
  }
  return null;
}

function sourceSummaries(): RemoteSourceSummary[] {
  return listSources().map((s) => ({
    id: s.id,
    displayName: s.displayName,
  }));
}

function currentRemoteSnapshot(host: SourceHost | null): {
  mode: "launcher" | "player";
  activeSourceId: string | null;
  capabilities: SourceCapabilities | null;
  sources: RemoteSourceSummary[];
} {
  const active = host?.getActiveSource() ?? null;
  return {
    mode: active ? "player" : "launcher",
    activeSourceId: active?.id ?? null,
    capabilities: active?.capabilities ?? null,
    sources: sourceSummaries(),
  };
}

/**
 * Laptop remote boundary: HTTP (mobile UI) + WebSocket (commands).
 * SOURCE-AGNOSTIC — no Netflix/YouTube/Hotstar/Prime branches.
 */
export async function startRemoteServer(
  deps: RemoteServerDeps,
): Promise<RemoteServer> {
  const host = deps.host ?? "0.0.0.0";
  const port = deps.port ?? resolveRemotePort();
  const clients = new Set<WebSocket>();

  const httpServer: HttpServer = createServer((req, res) => {
    handleRemoteStaticRequest(req, res, deps.staticRoot);
  });

  const wss = new WebSocketServer({ server: httpServer });

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
    const onError = (err: Error) => {
      httpServer.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      httpServer.off("error", onError);
      resolve();
    };
    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen(port, host);
  });

  console.log(
    `[remote] HTTP+WS listening on http://${host}:${port}` +
      (deps.staticRoot ? ` (ui: ${deps.staticRoot})` : " (ui missing)"),
  );

  return {
    port,
    host,
    broadcast,
    close: () =>
      new Promise((resolve, reject) => {
        for (const socket of clients) {
          try {
            socket.close();
          } catch {
            /* ignore */
          }
        }
        clients.clear();
        wss.close((wsErr) => {
          httpServer.close((httpErr) => {
            if (wsErr) reject(wsErr);
            else if (httpErr) reject(httpErr);
            else resolve();
          });
        });
      }),
  };
}

/** @deprecated Use startRemoteServer — kept as alias for older imports/tests. */
export async function startWsServer(
  deps: Omit<RemoteServerDeps, "staticRoot"> & { staticRoot?: string | null },
): Promise<RemoteServer> {
  return startRemoteServer({
    ...deps,
    staticRoot: deps.staticRoot ?? null,
  });
}

export type WsServer = RemoteServer;
export type WsServerDeps = Omit<RemoteServerDeps, "staticRoot"> & {
  staticRoot?: string | null;
};

async function handleMessage(
  deps: RemoteServerDeps,
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
    const snap = currentRemoteSnapshot(deps.getSourceHost());
    send(socket, {
      kind: "hello-ack",
      sessionId: crypto.randomUUID(),
      activeSourceId: snap.activeSourceId,
      capabilities: snap.capabilities,
      mode: snap.mode,
      sources: snap.sources,
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

  if (message.kind === "input") {
    const parsed = parseInputCommand(message.command);
    if (!parsed) {
      send(socket, {
        kind: "command-result",
        requestId: message.requestId,
        result: { ok: false, reason: "unknown" },
      });
      send(socket, {
        kind: "error",
        requestId: message.requestId,
        message: "invalid input command",
      });
      return;
    }

    const host = deps.getSourceHost();
    if (!host?.getActiveSourceId()) {
      send(socket, {
        kind: "command-result",
        requestId: message.requestId,
        result: { ok: false, reason: "no-active-session" },
      });
      return;
    }

    const result = host.handleInput(parsed);
    send(socket, {
      kind: "command-result",
      requestId: message.requestId,
      result,
    });
    if (result.ok && (parsed.type === "pointer-move" || parsed.type === "pointer-scroll")) {
      const cursor = host.getPointerCursorState();
      const payload = {
        kind: "cursor-position" as const,
        x: cursor.x,
        y: cursor.y,
        viewWidth: cursor.viewWidth,
        viewHeight: cursor.viewHeight,
      };
      broadcast(payload);
    }
    // Avoid toast spam for high-frequency pointer moves / scroll.
    if (
      parsed.type !== "pointer-move" &&
      parsed.type !== "pointer-scroll" &&
      parsed.type !== "pointer-down" &&
      parsed.type !== "pointer-up"
    ) {
      const toast = {
        message: result.ok ? parsed.type : `${parsed.type} failed`,
        ok: result.ok,
      };
      deps.onToast(toast);
      broadcast({ kind: "toast", ...toast });
    }
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

/** Build a context message from the current host — used by main on source changes. */
export function buildContextMessage(host: SourceHost | null): Extract<
  WsServerMessage,
  { kind: "context" }
> {
  const snap = currentRemoteSnapshot(host);
  return {
    kind: "context",
    mode: snap.mode,
    activeSourceId: snap.activeSourceId,
    capabilities: snap.capabilities,
    sources: snap.sources,
  };
}
