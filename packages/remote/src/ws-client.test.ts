import { describe, expect, it } from "vitest";
import {
  getOrCreateClientId,
  resolveWsUrl,
} from "./ws-client.js";

describe("remote ws-client helpers", () => {
  it("persists a stable client id in storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    const first = getOrCreateClientId(storage);
    const second = getOrCreateClientId(storage);
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(8);
  });

  it("randomId works without crypto.randomUUID", async () => {
    const { randomId } = await import("./ws-client.js");
    expect(randomId().length).toBeGreaterThan(8);
  });

  it("resolves WS URL from laptop-served page port", () => {
    expect(
      resolveWsUrl({
        hostname: "192.168.1.20",
        search: "",
        port: "17832",
      }),
    ).toBe("ws://192.168.1.20:17832");
  });

  it("defaults Vite dev port to the laptop remote port", () => {
    expect(
      resolveWsUrl({
        hostname: "localhost",
        search: "",
        port: "5174",
      }),
    ).toBe("ws://localhost:17832");
  });

  it("honors explicit ?ws= override", () => {
    expect(
      resolveWsUrl({
        hostname: "localhost",
        search: "?ws=19000",
        port: "5174",
      }),
    ).toBe("ws://localhost:19000");
  });
});
