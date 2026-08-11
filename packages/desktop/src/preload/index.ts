import { contextBridge, ipcRenderer } from "electron";

/**
 * Minimal IPC surface for the TV launcher renderer.
 * Keep this thin — business logic stays in main.
 */
const api = {
  listSources: (): Promise<
    Array<{ id: string; displayName: string; icon: { src: string; alt?: string } }>
  > => ipcRenderer.invoke("sources:list"),

  openSource: (sourceId: string): Promise<void> =>
    ipcRenderer.invoke("sources:open", sourceId),

  showLauncher: (): Promise<void> => ipcRenderer.invoke("launcher:show"),

  onToast: (handler: (payload: { message: string; ok: boolean }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { message: string; ok: boolean },
    ) => handler(payload);
    ipcRenderer.on("toast", listener);
    return () => ipcRenderer.removeListener("toast", listener);
  },
};

contextBridge.exposeInMainWorld("coosy", api);

export type CoosyApi = typeof api;
