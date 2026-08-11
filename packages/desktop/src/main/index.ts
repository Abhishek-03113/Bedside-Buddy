import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { initDb } from "./db/db.js";
import { SourceHost } from "./source-host.js";
import {
  buildContextMessage,
  resolveRemotePort,
  resolveRemoteStaticRoot,
  startRemoteServer,
  type RemoteServer,
} from "./remote-server.js";
import { startDiscovery } from "./discovery.js";
import { ensureWidevineReady } from "./widevine.js";
import {
  presentToast,
  registerIpcHandlers,
  sendContextToRenderer,
  sendNavToRenderer,
} from "./ipc.js";
import { getOrCreatePairingCode } from "./pairing.js";
import { ToastOverlay } from "./toast-overlay.js";
import { getLanIPv4 } from "./lan.js";

let mainWindow: BrowserWindow | null = null;
let sourceHost: SourceHost | null = null;
let remoteServer: RemoteServer | null = null;
let stopDiscovery: (() => void) | null = null;
let toastOverlay: ToastOverlay | null = null;
let remoteStartError: string | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    autoHideMenuBar: true,
    // Avoid a native title strip painting above the media surface on macOS.
    titleBarStyle: "hidden",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });

  toastOverlay = new ToastOverlay();
  toastOverlay.attach(mainWindow);

  sourceHost = new SourceHost(mainWindow, {
    onContextChange: ({ mode, activeSourceId }) => {
      remoteServer?.broadcast(buildContextMessage(sourceHost));
      sendContextToRenderer(mainWindow, { mode, activeSourceId });
      if (mode === "launcher") {
        toastOverlay?.hide();
      }
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // Warm source WebContentsViews so the first tile click is attach-only.
  sourceHost.warmSources();

  mainWindow.on("closed", () => {
    sourceHost?.dispose();
    toastOverlay?.dispose();
    mainWindow = null;
    sourceHost = null;
    toastOverlay = null;
  });
}

async function startAuxiliaryRemote(): Promise<void> {
  const staticRoot = resolveRemoteStaticRoot({
    desktopOutDir: join(__dirname, ".."),
  });

  try {
    remoteServer = await startRemoteServer({
      getSourceHost: () => sourceHost,
      staticRoot,
      onToast: (payload) =>
        presentToast({
          window: mainWindow,
          host: sourceHost,
          overlay: toastOverlay,
          payload,
        }),
      onNav: (action) => sendNavToRenderer(mainWindow, action),
    });
    remoteStartError = null;

    try {
      stopDiscovery = await startDiscovery(remoteServer.port);
    } catch (err) {
      console.warn("[discovery] failed to advertise (remote still up)", err);
    }

    const ip = getLanIPv4() ?? "<lan-ip>";
    console.log(
      `[pairing] code ${getOrCreatePairingCode()} — open http://${ip}:${remoteServer.port}`,
    );
    if (!staticRoot) {
      console.warn(
        "[remote] UI assets missing — run `pnpm --filter @coosy/remote build` (or desktop package script)",
      );
    }
  } catch (err) {
    remoteServer = null;
    remoteStartError =
      err instanceof Error ? err.message : "Remote server failed to start";
    console.error("[remote] startup failed — desktop continues without remote", err);
  }
}

app.whenReady().then(async () => {
  initDb();
  getOrCreatePairingCode();

  await ensureWidevineReady();
  await createWindow();

  registerIpcHandlers({
    getWindow: () => mainWindow,
    getSourceHost: () => sourceHost,
    getWsPort: () => remoteServer?.port ?? resolveRemotePort(),
    getRemoteError: () => remoteStartError,
  });

  await startAuxiliaryRemote();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopDiscovery?.();
  stopDiscovery = null;
  void remoteServer?.close().catch((err) => {
    console.warn("[remote] close error", err);
  });
  remoteServer = null;
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopDiscovery?.();
  stopDiscovery = null;
  void remoteServer?.close().catch(() => undefined);
  remoteServer = null;
});
