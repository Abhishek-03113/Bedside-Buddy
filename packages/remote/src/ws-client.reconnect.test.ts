import { describe, expect, it, vi } from "vitest";
import { createWsClient } from "./ws-client.js";

class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  url: string;
  private listeners = new Map<string, Set<(event: { data?: string }) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.emit("open");
    });
  }

  addEventListener(type: string, handler: (event: { data?: string }) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  send(_data: string) {
    /* inspected via instances */
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  emit(type: string, data?: string) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler({ data });
    }
  }
}

describe("createWsClient reconnect", () => {
  it("reconnects after an unexpected close and does not loop after intentional close", async () => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();

    const client = createWsClient({
      url: "ws://example.test",
      clientId: "fixed-id",
      pairingCode: "123456",
      reconnectDelayMs: 1000,
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(FakeWebSocket.instances).toHaveLength(1);

    const statuses: string[] = [];
    client.onStatus((s) => statuses.push(s));

    // Simulate successful hello-ack
    FakeWebSocket.instances[0]!.emit(
      "message",
      JSON.stringify({
        kind: "hello-ack",
        sessionId: "s1",
        activeSourceId: null,
        capabilities: null,
        mode: "launcher",
        sources: [],
      }),
    );
    expect(client.status).toBe("CONNECTED");

    FakeWebSocket.instances[0]!.close();
    expect(client.status).toBe("CONNECTING");

    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    client.close();
    expect(client.status).toBe("DISCONNECTED");
    const countAfterClose = FakeWebSocket.instances.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(FakeWebSocket.instances.length).toBe(countAfterClose);

    vi.useRealTimers();
  });

  it("delivers context and toast updates without inventing local state", async () => {
    FakeWebSocket.instances = [];
    const client = createWsClient({
      url: "ws://example.test",
      clientId: "fixed-id",
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    });

    await Promise.resolve();
    await Promise.resolve();

    const contexts: Array<{ mode: string; activeSourceId: string | null }> = [];
    const toasts: Array<{ message: string; ok: boolean }> = [];
    client.onContext((ctx) =>
      contexts.push({ mode: ctx.mode, activeSourceId: ctx.activeSourceId }),
    );
    client.onToast((t) => toasts.push(t));

    FakeWebSocket.instances[0]!.emit(
      "message",
      JSON.stringify({
        kind: "hello-ack",
        sessionId: "s1",
        activeSourceId: null,
        capabilities: null,
        mode: "launcher",
        sources: [{ id: "netflix", displayName: "Netflix" }],
      }),
    );

    FakeWebSocket.instances[0]!.emit(
      "message",
      JSON.stringify({
        kind: "context",
        mode: "player",
        activeSourceId: "netflix",
        capabilities: {
          supportsSeek: true,
          supportsNextEpisode: true,
          supportsVolume: true,
          supportsScroll: true,
          supportsSearch: true,
          supportsBrowseNavigate: true,
        },
        sources: [{ id: "netflix", displayName: "Netflix" }],
      }),
    );
    FakeWebSocket.instances[0]!.emit(
      "message",
      JSON.stringify({ kind: "toast", message: "activate", ok: true }),
    );

    expect(contexts).toEqual([{ mode: "player", activeSourceId: "netflix" }]);
    expect(toasts).toEqual([
      { kind: "toast", message: "activate", ok: true },
    ]);
    client.close();
  });
});
