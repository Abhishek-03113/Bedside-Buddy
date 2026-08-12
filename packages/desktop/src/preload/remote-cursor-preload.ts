import { contextBridge, ipcRenderer } from "electron";

export interface RemoteCursorUpdate {
  x: number;
  y: number;
  visible: boolean;
}

contextBridge.exposeInMainWorld("coosyCursor", {
  onUpdate(callback: (state: RemoteCursorUpdate) => void): () => void {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: RemoteCursorUpdate,
    ) => {
      callback(state);
    };

    ipcRenderer.on("coosy:remote-cursor", listener);

    return () => {
      ipcRenderer.removeListener("coosy:remote-cursor", listener);
    };
  },
});
