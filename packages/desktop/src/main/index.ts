import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { initDb } from "./db/db.js";
import { SourceHost } from "./source-host.js";
import { startWsServer, type WsServer } from "./ws-server.js";
import { startDiscovery } from "./discovery.js";
import { ensureWidevineReady } from "./widevine.js";
import {
  registerIpcHandlers,
  sendNavToRenderer,
  sendToastToRenderer,
} from "./ipc.js";
import { getOrCreatePairingCode } from "./pairing.js";
import type { SourceCapabilities } from "@coosy/shared";
import { SOURCES } from "./sources/registry.js";

let mainWindow: BrowserWindow | null = null;
let sourceHost: SourceHost | null = null;
let wsServer: WsServer | null = null;
let stopDiscovery: (() => void) | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  sourceHost = new SourceHost(mainWindow, {
    onContextChange: ({ mode, activeSourceId }) => {
      const capabilities: SourceCapabilities | null = activeSourceId
        ? (SOURCES[activeSourceId]?.capabilities ?? null)
        : null;
      wsServer?.broadcast({
        kind: "context",
        mode,
        activeSourceId,
        capabilities,
      });
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    sourceHost?.dispose();
    mainWindow = null;
    sourceHost = null;
  });
}

app.whenReady().then(async () => {
  initDb();
  getOrCreatePairingCode();

  await ensureWidevineReady();
  await createWindow();

  registerIpcHandlers({
    getWindow: () => mainWindow,
    getSourceHost: () => sourceHost,
    getWsPort: () => wsServer?.port ?? Number(process.env.COOSY_WS_PORT ?? 17832),
  });

  wsServer = await startWsServer({
    getSourceHost: () => sourceHost,
    onToast: (payload) => sendToastToRenderer(mainWindow, payload),
    onNav: (action) => sendNavToRenderer(mainWindow, action),
  });

  stopDiscovery = await startDiscovery(wsServer.port);

  console.log(
    `[pairing] code ${getOrCreatePairingCode()} — connect ws://<lan-ip>:${wsServer.port}`,
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopDiscovery?.();
  void wsServer?.close();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
