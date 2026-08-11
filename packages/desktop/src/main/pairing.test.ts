import { afterEach, describe, expect, it, vi } from "vitest";

describe("pairing authorizeHello", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("./db/db.js");
  });

  it("accepts correct code once, then trusts clientId", async () => {
    const state = new Map<string, string>();
    vi.doMock("./db/db.js", () => ({
      getAppState: (key: string) => state.get(key) ?? null,
      setAppState: (key: string, value: string) => {
        state.set(key, value);
      },
    }));

    const { authorizeHello, getOrCreatePairingCode } = await import("./pairing.js");
    const code = getOrCreatePairingCode();
    expect(code).toMatch(/^\d{6}$/);

    expect(
      authorizeHello({ clientId: "phone-1" }),
    ).toEqual({
      ok: false,
      reason: "pairing required — enter the code shown on the TV",
    });

    expect(
      authorizeHello({ clientId: "phone-1", pairingCode: "000000" }),
    ).toMatchObject({ ok: false });

    expect(
      authorizeHello({ clientId: "phone-1", pairingCode: code }),
    ).toEqual({ ok: true });

    expect(authorizeHello({ clientId: "phone-1" })).toEqual({ ok: true });
    expect(authorizeHello({ clientId: "phone-2" })).toMatchObject({ ok: false });
  });
});
