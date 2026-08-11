import { ipcMain, type BrowserWindow } from "electron";
import type { SourceHost } from "./source-host.js";
import { listSources } from "./sources/registry.js";
import { getLanIPv4 } from "./lan.js";
import { getOrCreatePairingCode } from "./pairing.js";

export interface ConnectionInfo {
  ip: string | null;
  port: number;
  pairingCode: string;
  mdnsName: string;
}

export function registerIpcHandlers(opts: {
  getWindow: () => BrowserWindow | null;
  getSourceHost: () => SourceHost | null;
  getWsPort: () => number;
}): void {
  ipcMain.handle("sources:list", () =>
    listSources().map((s) => ({
      id: s.id,
      displayName: s.displayName,
      icon: s.icon,
      capabilities: s.capabilities,
    })),
  );

  ipcMain.handle("sources:open", async (_event, sourceId: string) => {
    const host = opts.getSourceHost();
    if (!host) throw new Error("SourceHost not ready");
    await host.showSource(sourceId);
  });

  ipcMain.handle("launcher:show", async () => {
    const host = opts.getSourceHost();
    if (!host) throw new Error("SourceHost not ready");
    await host.showLauncher();
  });

  ipcMain.handle("connection:info", (): ConnectionInfo => ({
    ip: getLanIPv4(),
    port: opts.getWsPort(),
    pairingCode: getOrCreatePairingCode(),
    mdnsName: "CoOSy",
  }));
}

export function sendToastToRenderer(
  window: BrowserWindow | null,
  payload: { message: string; ok: boolean },
): void {
  window?.webContents.send("toast", payload);
}

export function sendNavToRenderer(
  window: BrowserWindow | null,
  action: string,
): void {
  window?.webContents.send("nav", action);
}
