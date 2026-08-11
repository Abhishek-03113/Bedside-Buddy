import { contextBridge, ipcRenderer } from "electron";
import type { NavAction, PlaybackHistoryItem, SourceCapabilities } from "@coosy/shared";

export interface SourceListItem {
  id: string;
  displayName: string;
  icon: { src: string; alt?: string };
  capabilities: SourceCapabilities;
}

export interface ConnectionInfo {
  ip: string | null;
  port: number;
  pairingCode: string;
  mdnsName: string;
  httpUrl: string | null;
  remoteError: string | null;
}

/**
 * Minimal IPC surface for the TV launcher renderer.
 * Keep this thin — business logic stays in main.
 */
const api = {
  listSources: (): Promise<SourceListItem[]> =>
    ipcRenderer.invoke("sources:list"),

  openSource: (sourceId: string): Promise<void> =>
    ipcRenderer.invoke("sources:open", sourceId),

  listPlaybackHistory: (): Promise<PlaybackHistoryItem[]> =>
    ipcRenderer.invoke("playback-history:list"),

  resumePlaybackHistory: (item: { sourceId: string; contentUrl: string }): Promise<void> =>
    ipcRenderer.invoke("playback-history:resume", item),

  showLauncher: (): Promise<void> => ipcRenderer.invoke("launcher:show"),

  getConnectionInfo: (): Promise<ConnectionInfo> =>
    ipcRenderer.invoke("connection:info"),

  onToast: (handler: (payload: { message: string; ok: boolean }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { message: string; ok: boolean },
    ) => handler(payload);
    ipcRenderer.on("toast", listener);
    return () => ipcRenderer.removeListener("toast", listener);
  },

  onNav: (handler: (action: NavAction) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: NavAction) =>
      handler(action);
    ipcRenderer.on("nav", listener);
    return () => ipcRenderer.removeListener("nav", listener);
  },

  onContext: (
    handler: (payload: {
      mode: "launcher" | "player";
      activeSourceId: string | null;
    }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: {
        mode: "launcher" | "player";
        activeSourceId: string | null;
      },
    ) => handler(payload);
    ipcRenderer.on("context", listener);
    return () => ipcRenderer.removeListener("context", listener);
  },
};

contextBridge.exposeInMainWorld("coosy", api);

export type CoosyApi = typeof api;
