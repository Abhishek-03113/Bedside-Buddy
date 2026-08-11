import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLauncherBootstrapCache,
  getCachedLauncherBootstrap,
  loadLauncherBootstrap,
} from "./launcher-bootstrap.js";

describe("launcher bootstrap cache", () => {
  afterEach(() => {
    clearLauncherBootstrapCache();
    vi.unstubAllGlobals();
  });

  it("fetches via IPC once, then serves the session cache", async () => {
    const listSources = vi.fn().mockResolvedValue([
      {
        id: "netflix",
        displayName: "Netflix",
        icon: { src: "n" },
        capabilities: {},
      },
    ]);
    const getConnectionInfo = vi.fn().mockResolvedValue({
      ip: "10.0.0.1",
      port: 17832,
      pairingCode: "123456",
      mdnsName: "CoOSy",
    });

    vi.stubGlobal("window", {
      coosy: { listSources, getConnectionInfo },
    });

    expect(getCachedLauncherBootstrap()).toBeNull();

    const first = await loadLauncherBootstrap();
    expect(first.fromCache).toBe(false);
    expect(listSources).toHaveBeenCalledTimes(1);
    expect(getConnectionInfo).toHaveBeenCalledTimes(1);

    const second = await loadLauncherBootstrap();
    expect(second.fromCache).toBe(true);
    expect(listSources).toHaveBeenCalledTimes(1);
    expect(getConnectionInfo).toHaveBeenCalledTimes(1);
    expect(second.sources).toBe(first.sources);
  });
});
