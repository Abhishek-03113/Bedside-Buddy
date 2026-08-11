import { createServer } from "node:http";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import type { MediaSource, NavAction, RemoteCommand } from "@coosy/shared";
import {
  buildContextMessage,
  resolveRemoteStaticRoot,
  startRemoteServer,
  type RemoteServer,
} from "./remote-server.js";

vi.mock("./pairing.js", () => {
  const trusted = new Set<string>();
  const CODE = "654321";
  return {
    authorizeHello: (opts: { clientId: string; pairingCode?: string }) => {
      if (trusted.has(opts.clientId)) return { ok: true as const };
      if (opts.pairingCode === CODE) {
        trusted.add(opts.clientId);
        return { ok: true as const };
      }
      return {
        ok: false as const,
        reason: "pairing required — enter the code shown on the TV",
      };
    },
    __trusted: trusted,
    __CODE: CODE,
  };
});

vi.mock("./sources/registry.js", () => {
  const handleCommand = vi.fn(async (_command: RemoteCommand) => ({
    ok: true as const,
  }));
  const source = {
    id: "netflix",
    displayName: "Netflix",
    capabilities: {
      supportsSeek: true,
      supportsNextEpisode: false,
      supportsVolume: true,
      supportsScroll: true,
      supportsSearch: true,
      supportsBrowseNavigate: true,
    },
    handleCommand,
  };
  return {
    SOURCES: { netflix: source },
    listSources: () => [source],
    __handleCommand: handleCommand,
  };
});

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no port"));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
  });
}

function waitForMessage(
  ws: WebSocket,
  predicate: (msg: Record<string, unknown>) => boolean,
  timeoutMs = 3000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for message")), timeoutMs);
    const onMessage = (raw: WebSocket.RawData) => {
      const msg = JSON.parse(String(raw)) as Record<string, unknown>;
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(msg);
      }
    };
    ws.on("message", onMessage);
  });
}

describe("remote server foundation", () => {
  let server: RemoteServer | null = null;
  let staticRoot: string | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
    if (staticRoot) {
      rmSync(staticRoot, { recursive: true, force: true });
      staticRoot = null;
    }
  });

  it("starts HTTP+WS, serves UI, pairs, forwards nav/commands, shuts down cleanly", async () => {
    staticRoot = join(tmpdir(), `coosy-remote-${Date.now()}`);
    mkdirSync(staticRoot, { recursive: true });
    writeFileSync(join(staticRoot, "index.html"), "<!doctype html><title>remote</title>");

    const navActions: NavAction[] = [];
    const toasts: { message: string; ok: boolean }[] = [];
    let activeId: string | null = null;

    const host = {
      getActiveSourceId: () => activeId,
      getActiveSource: () =>
        activeId
          ? ({
              id: activeId,
              displayName: "Netflix",
              capabilities: {
                supportsSeek: true,
                supportsNextEpisode: false,
                supportsVolume: true,
                supportsScroll: true,
                supportsSearch: true,
                supportsBrowseNavigate: true,
              },
            } as MediaSource)
          : null,
    };

    const port = await freePort();
    server = await startRemoteServer({
      port,
      host: "127.0.0.1",
      staticRoot,
      getSourceHost: () => host as never,
      onNav: (action) => navActions.push(action),
      onToast: (t) => toasts.push(t),
    });

    const html = await fetch(`http://127.0.0.1:${port}/`);
    expect(html.status).toBe(200);
    expect(await html.text()).toContain("remote");

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(await health.text()).toBe("ok");

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });

    ws.send(JSON.stringify({ kind: "hello", clientId: "client-a" }));
    const denied = await waitForMessage(ws, (m) => m.kind === "error");
    expect(String(denied.message)).toContain("pairing");

    ws.send(
      JSON.stringify({
        kind: "hello",
        clientId: "client-a",
        pairingCode: "654321",
      }),
    );
    const ack = await waitForMessage(ws, (m) => m.kind === "hello-ack");
    expect(ack.activeSourceId).toBeNull();
    expect(ack.mode).toBe("launcher");
    expect(ack.sources).toEqual([
      { id: "netflix", displayName: "Netflix" },
    ]);

    ws.send(
      JSON.stringify({
        kind: "nav",
        requestId: "n1",
        action: "home",
      }),
    );
    await waitForMessage(ws, (m) => m.kind === "toast" && m.message === "nav:home");
    expect(navActions).toContain("home");

    ws.send(
      JSON.stringify({
        kind: "nav",
        requestId: "n2",
        action: "select",
      }),
    );
    await waitForMessage(ws, (m) => m.kind === "toast" && m.message === "nav:select");
    expect(navActions).toContain("select");

    ws.send(
      JSON.stringify({
        kind: "nav",
        requestId: "n3",
        action: "up",
      }),
    );
    await waitForMessage(ws, (m) => m.kind === "toast" && m.message === "nav:up");

    // Media command without active source → honest failure
    ws.send(
      JSON.stringify({
        kind: "command",
        requestId: "c0",
        command: { type: "toggle-play-pause" },
      }),
    );
    const noSession = await waitForMessage(
      ws,
      (m) => m.kind === "command-result" && m.requestId === "c0",
    );
    expect(noSession.result).toEqual({ ok: false, reason: "no-active-session" });

    activeId = "netflix";
    const registryMod = (await import("./sources/registry.js")) as unknown as {
      __handleCommand: ReturnType<typeof vi.fn>;
    };
    const { __handleCommand } = registryMod;

    ws.send(
      JSON.stringify({
        kind: "command",
        requestId: "c1",
        command: { type: "toggle-play-pause" },
      }),
    );
    const okResult = await waitForMessage(
      ws,
      (m) => m.kind === "command-result" && m.requestId === "c1",
    );
    expect(okResult.result).toEqual({ ok: true });
    expect(__handleCommand).toHaveBeenCalledWith({ type: "toggle-play-pause" });

    ws.send(
      JSON.stringify({
        kind: "command",
        requestId: "c-scroll",
        command: { type: "scroll", direction: "down" },
      }),
    );
    await waitForMessage(
      ws,
      (m) => m.kind === "command-result" && m.requestId === "c-scroll",
    );
    expect(__handleCommand).toHaveBeenCalledWith({
      type: "scroll",
      direction: "down",
    });

    ws.send(
      JSON.stringify({
        kind: "command",
        requestId: "c-search",
        command: { type: "search", query: "dark" },
      }),
    );
    await waitForMessage(
      ws,
      (m) => m.kind === "command-result" && m.requestId === "c-search",
    );
    expect(__handleCommand).toHaveBeenCalledWith({
      type: "search",
      query: "dark",
    });

    ws.send(
      JSON.stringify({
        kind: "nav",
        requestId: "n-home",
        action: "home",
      }),
    );
    await waitForMessage(
      ws,
      (m) => m.kind === "toast" && m.message === "nav:home",
    );
    expect(navActions).toContain("home");

    // Trusted reconnect without code
    ws.close();
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      ws2.once("open", () => resolve());
      ws2.once("error", reject);
    });
    ws2.send(JSON.stringify({ kind: "hello", clientId: "client-a" }));
    const ack2 = await waitForMessage(ws2, (m) => m.kind === "hello-ack");
    expect(ack2.sessionId).toBeTruthy();
    expect(ack2.activeSourceId).toBe("netflix");
    expect(ack2.mode).toBe("player");

    // Context broadcast shape
    const ctx = buildContextMessage(host as never);
    expect(ctx).toMatchObject({
      kind: "context",
      mode: "player",
      activeSourceId: "netflix",
      sources: [{ id: "netflix", displayName: "Netflix" }],
    });
    server.broadcast(ctx);
    const gotCtx = await waitForMessage(ws2, (m) => m.kind === "context");
    expect(gotCtx.activeSourceId).toBe("netflix");

    ws2.close();
    await server.close();
    server = null;

    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
  });

  it("rejects path traversal and returns 503 when UI assets are missing", async () => {
    const port = await freePort();
    server = await startRemoteServer({
      port,
      host: "127.0.0.1",
      staticRoot: null,
      getSourceHost: () => null,
      onNav: () => undefined,
      onToast: () => undefined,
    });

    const missing = await fetch(`http://127.0.0.1:${port}/`);
    expect(missing.status).toBe(503);

    staticRoot = join(tmpdir(), `coosy-remote-safe-${Date.now()}`);
    mkdirSync(staticRoot, { recursive: true });
    writeFileSync(join(staticRoot, "index.html"), "ok");
    await server.close();

    const port2 = await freePort();
    server = await startRemoteServer({
      port: port2,
      host: "127.0.0.1",
      staticRoot,
      getSourceHost: () => null,
      onNav: () => undefined,
      onToast: () => undefined,
    });

    const evil = await fetch(`http://127.0.0.1:${port2}/../../etc/passwd`);
    // Either forbidden or SPA-fallback to index — never leaks outside root as file content of passwd
    const body = await evil.text();
    expect(body).not.toContain("root:");
  });

  it("resolveRemoteStaticRoot finds index.html candidates", () => {
    staticRoot = join(tmpdir(), `coosy-resolve-${Date.now()}`);
    const nested = join(staticRoot, "remote");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, "index.html"), "ui");
    expect(
      resolveRemoteStaticRoot({
        desktopOutDir: staticRoot,
        candidates: [join(staticRoot, "remote")],
      }),
    ).toBe(nested);
    expect(
      resolveRemoteStaticRoot({
        desktopOutDir: staticRoot,
        candidates: [join(staticRoot, "missing")],
      }),
    ).toBeNull();
  });
});
