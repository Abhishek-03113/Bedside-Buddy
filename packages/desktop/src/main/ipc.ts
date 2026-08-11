import { ipcMain, type BrowserWindow } from "electron";
import type { SourceHost } from "./source-host.js";
import { listSources } from "./sources/registry.js";
import { getRecentPlayback } from "./db/db.js";
import { getLanIPv4 } from "./lan.js";
import { getOrCreatePairingCode } from "./pairing.js";
import type { ToastOverlay } from "./toast-overlay.js";

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

  ipcMain.handle("playback-history:list", () => getRecentPlayback(4));

  ipcMain.handle("playback-history:resume", async (_event, item: { sourceId: string; contentUrl: string }) => {
    const host = opts.getSourceHost();
    if (!host) throw new Error("SourceHost not ready");
    await host.resumePlayback(item.sourceId, item.contentUrl);
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

export function sendContextToRenderer(
  window: BrowserWindow | null,
  payload: { mode: "launcher" | "player"; activeSourceId: string | null },
): void {
  window?.webContents.send("context", payload);
}

/**
 * Player-mode toasts use a temporary overlay window (source is fullscreen).
 * Launcher-mode toasts still go to the React renderer.
 */
export function presentToast(opts: {
  window: BrowserWindow | null;
  host: SourceHost | null;
  overlay: ToastOverlay | null;
  payload: { message: string; ok: boolean };
}): void {
  const { window, host, overlay, payload } = opts;
  if (host?.getActiveSourceId() && overlay) {
    overlay.show(payload);
    return;
  }
  sendToastToRenderer(window, payload);
}
