import { BrowserWindow } from "electron";

export interface RemoteCursorState {
  x: number;
  y: number;
  visible: boolean;
}

export class RemoteCursorOverlay {
  private readonly parent: BrowserWindow;
  private window: BrowserWindow | null = null;
  private ready = false;
  private pendingState: RemoteCursorState | null = null;
  private boundWindowListeners: Array<() => void> = [];

  constructor(parent: BrowserWindow) {
    this.parent = parent;
    this.ensureWindow();
  }

  dispose(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
    this.ready = false;
    this.pendingState = null;
    for (const unbind of this.boundWindowListeners) unbind();
    this.boundWindowListeners = [];
  }

  update(state: RemoteCursorState): void {
    this.positionWindow();
    if (!this.window || this.window.isDestroyed()) return;

    if (!this.ready) {
      this.pendingState = state;
      return;
    }

    try {
      this.window.webContents.send("coosy:remote-cursor", {
        x: Math.round(state.x),
        y: Math.round(state.y),
        visible: !!state.visible,
      });
    } catch {
      // ignore
    }

    if (state.visible && !this.window.isVisible()) this.window.showInactive();
    if (!state.visible && this.window.isVisible()) this.window.hide();
  }

  hide(): void {
    if (!this.window || this.window.isDestroyed()) return;
    if (this.window.isVisible()) {
      this.window.hide();
    }
  }

  private ensureWindow(): void {
    if (this.window && !this.window.isDestroyed()) return;

    const bounds = this.parent.getContentBounds();
    this.window = new BrowserWindow({
      parent: this.parent,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      x: bounds.x,
      y: bounds.y,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      show: false,
      alwaysOnTop: true,
      webPreferences: {
        // Allow IPC in this isolated overlay so we can send frequent cursor updates
        // without executing JS every frame.
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    this.window.setAlwaysOnTop(true, "pop-up-menu");
    this.window.setIgnoreMouseEvents(true, { forward: true });
    this.window.loadURL(this.cursorHtml());
    this.window.webContents.once("did-finish-load", () => {
      this.ready = true;
      if (this.pendingState) {
        this.update(this.pendingState);
        this.pendingState = null;
      }
    });

    // Keep overlay in sync with the parent window.
    const onParentMoveResize = () => this.positionWindow();
    const onParentHide = () => this.hide();
    const onParentClose = () => this.dispose();

    this.parent.on("move", onParentMoveResize);
    this.parent.on("resize", onParentMoveResize);
    this.parent.on("maximize", onParentMoveResize);
    this.parent.on("unmaximize", onParentMoveResize);
    this.parent.on("enter-full-screen", onParentMoveResize);
    this.parent.on("leave-full-screen", onParentMoveResize);
    this.parent.on("minimize", onParentHide);
    this.parent.on("restore", onParentMoveResize);
    this.parent.on("closed", onParentClose);

    this.boundWindowListeners.push(() => this.parent.removeListener("move", onParentMoveResize));
    this.boundWindowListeners.push(() => this.parent.removeListener("resize", onParentMoveResize));
    this.boundWindowListeners.push(() => this.parent.removeListener("maximize", onParentMoveResize));
    this.boundWindowListeners.push(() => this.parent.removeListener("unmaximize", onParentMoveResize));
    this.boundWindowListeners.push(() => this.parent.removeListener("enter-full-screen", onParentMoveResize));
    this.boundWindowListeners.push(() => this.parent.removeListener("leave-full-screen", onParentMoveResize));
    this.boundWindowListeners.push(() => this.parent.removeListener("minimize", onParentHide));
    this.boundWindowListeners.push(() => this.parent.removeListener("restore", onParentMoveResize));
    this.boundWindowListeners.push(() => this.parent.removeListener("closed", onParentClose));
  }

  private positionWindow(): void {
    if (!this.window || this.window.isDestroyed()) return;
    const bounds = this.parent.getContentBounds();
    this.window.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
    });
  }

  private cursorHtml(): string {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden;}#coosy-virtual-pointer{position:absolute;width:18px;height:18px;border:2px solid white;border-radius:50%;box-sizing:border-box;pointer-events:none;z-index:2147483647;transform:translate(-50%, -50%);opacity:0.9;}</style></head><body><div id="coosy-virtual-pointer"></div><script>const {ipcRenderer} = require('electron');let pending=null;let frame=false;const dot=document.getElementById('coosy-virtual-pointer');function renderState(s){if(!dot) return;dot.style.left=(s.x)+'px';dot.style.top=(s.y)+'px';dot.style.display=s.visible?'block':'none';}ipcRenderer.on('coosy:remote-cursor',(_, state)=>{pending=state;if(frame) return;frame=true;requestAnimationFrame(()=>{frame=false;if(pending) renderState(pending);pending=null;});});renderState({x:0,y:0,visible:false});</script></body></html>`;
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }
}
