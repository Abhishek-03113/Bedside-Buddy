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
  }

  update(state: RemoteCursorState): void {
    this.positionWindow();
    if (!this.window || this.window.isDestroyed()) return;

    if (!this.ready) {
      this.pendingState = state;
      return;
    }

    const script = `window.updatePointer(${Math.round(state.x)}, ${Math.round(
      state.y,
    )}, ${state.visible})`;
    this.window.webContents.executeJavaScript(script).catch(() => {
      // Ignore overlay update failures.
    });

    if (state.visible && !this.window.isVisible()) {
      this.window.showInactive();
    }
    if (!state.visible && this.window.isVisible()) {
      this.window.hide();
    }
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
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
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
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden;}#coosy-virtual-pointer{position:absolute;width:18px;height:18px;border:2px solid white;border-radius:50%;box-sizing:border-box;pointer-events:none;z-index:2147483647;transform:translate(-50%, -50%);opacity:0.9;}</style></head><body><div id="coosy-virtual-pointer"></div><script>window.updatePointer=(x,y,visible)=>{const dot=document.getElementById('coosy-virtual-pointer');if(!dot) return;dot.style.left=x+'px';dot.style.top=y+'px';dot.style.display=visible?'block':'none';};window.updatePointer(0,0,false);</script></body></html>`;
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }
}
