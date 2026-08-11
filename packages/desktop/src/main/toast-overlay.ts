import { BrowserWindow } from "electron";
import { perfInc } from "../shared/perf.js";

/**
 * Temporary toast surface above an active source WebContentsView.
 * Does not reserve permanent layout space in the source viewport.
 *
 * Lifecycle: create overlay once → reuse → update content → show → hide.
 */
export class ToastOverlay {
  private window: BrowserWindow | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private parent: BrowserWindow | null = null;
  private lastBounds: { x: number; y: number; width: number; height: number } | null =
    null;

  attach(parent: BrowserWindow): void {
    this.parent = parent;
  }

  show(payload: { message: string; ok: boolean }, durationMs = 1500): void {
    const parent = this.parent;
    if (!parent || parent.isDestroyed()) return;

    perfInc("toast.show");
    this.ensureWindow(parent);
    const win = this.window;
    if (!win || win.isDestroyed()) return;

    this.position(parent, win);
    void win.loadURL(toastDataUrl(payload));
    if (!win.isVisible()) {
      win.showInactive();
    }

    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), durationMs);
  }

  hide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.window && !this.window.isDestroyed() && this.window.isVisible()) {
      this.window.hide();
    }
  }

  dispose(): void {
    this.hide();
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
    this.parent = null;
    this.lastBounds = null;
  }

  private ensureWindow(parent: BrowserWindow): void {
    if (this.window && !this.window.isDestroyed()) return;

    this.window = new BrowserWindow({
      parent,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      width: 420,
      height: 64,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    this.window.setAlwaysOnTop(true, "pop-up-menu");
    this.window.setIgnoreMouseEvents(true, { forward: true });
  }

  private position(parent: BrowserWindow, win: BrowserWindow): void {
    const bounds = parent.getBounds();
    const width = Math.min(420, Math.max(280, bounds.width - 48));
    const height = 64;
    const x = Math.round(bounds.x + (bounds.width - width) / 2);
    const y = Math.round(bounds.y + bounds.height - height - 28);
    const next = { x, y, width, height };
    const prev = this.lastBounds;
    if (
      prev &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.width === next.width &&
      prev.height === next.height
    ) {
      return;
    }
    win.setBounds(next);
    this.lastBounds = next;
  }
}

function toastDataUrl(payload: { message: string; ok: boolean }): string {
  const bg = payload.ok ? "#1b5e20" : "#7f1d1d";
  const message = escapeHtml(payload.message);
  const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  html, body { margin: 0; background: transparent; }
  body { display: grid; place-items: center; height: 100vh; font-family: system-ui, sans-serif; }
  .toast {
    pointer-events: none;
    padding: 0.65rem 1.1rem;
    border-radius: 10px;
    background: ${bg};
    color: #f2f2f2;
    font-size: 15px;
    letter-spacing: 0.01em;
    box-shadow: 0 8px 24px rgba(0,0,0,0.45);
    max-width: 90vw;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style></head>
<body><div class="toast" role="status">${message}</div></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
