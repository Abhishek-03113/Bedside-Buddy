import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { initDb } from "./db/db.js";
import { SourceHost } from "./source-host.js";
import { startWsServer } from "./ws-server.js";
import { startDiscovery } from "./discovery.js";

let mainWindow: BrowserWindow | null = null;
let sourceHost: SourceHost | null = null;

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

  sourceHost = new SourceHost(mainWindow);

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    sourceHost = null;
  });
}

app.whenReady().then(async () => {
  initDb();
  await createWindow();

  const port = await startWsServer({
    getSourceHost: () => sourceHost,
  });
  await startDiscovery(port);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
