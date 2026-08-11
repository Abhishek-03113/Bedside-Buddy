import type { BrowserWindow, WebContentsView } from "electron";
import { WebContentsView as ElectronWebContentsView } from "electron";
import type { CommandResult, MediaSource } from "@coosy/shared";
import { SOURCES } from "./sources/registry.js";
import { touchSource, setAppState } from "./db/db.js";

export type ContextMode = "launcher" | "player";

export interface SourceHostEvents {
  onContextChange: (payload: {
    mode: ContextMode;
    activeSourceId: string | null;
  }) => void;
}

/**
 * Owns WebContentsView lifecycle and session partitions.
 * SOURCE-AGNOSTIC — never branches on Netflix / YouTube / etc.
 */
export class SourceHost {
  private readonly window: BrowserWindow;
  private readonly events: SourceHostEvents;
  private readonly views = new Map<string, WebContentsView>();
  private activeSourceId: string | null = null;
  private resizeHandler: (() => void) | null = null;

  constructor(window: BrowserWindow, events: SourceHostEvents) {
    this.window = window;
    this.events = events;
    this.resizeHandler = () => this.syncActiveBounds();
    this.window.on("resize", this.resizeHandler);
  }

  dispose(): void {
    if (this.resizeHandler) {
      this.window.removeListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  getActiveSourceId(): string | null {
    return this.activeSourceId;
  }

  getActiveSource(): MediaSource | null {
    if (!this.activeSourceId) return null;
    return SOURCES[this.activeSourceId] ?? null;
  }

  getActiveView(): WebContentsView | null {
    if (!this.activeSourceId) return null;
    return this.views.get(this.activeSourceId) ?? null;
  }

  async showSource(sourceId: string): Promise<void> {
    const source = SOURCES[sourceId];
    if (!source) {
      throw new Error(`Unknown source: ${sourceId}`);
    }

    if (this.activeSourceId && this.activeSourceId !== sourceId) {
      const previous = SOURCES[this.activeSourceId];
      if (previous) {
        await previous.handleCommand({ type: "pause" });
      }
      this.hideView(this.activeSourceId);
    }

    let view = this.views.get(sourceId);
    if (!view) {
      view = this.createView(source);
      this.views.set(sourceId, view);
      await view.webContents.loadURL(source.homeUrl);
    }

    this.bindSourceInput(source, view);
    this.attachView(view);
    this.activeSourceId = sourceId;
    touchSource(sourceId);
    setAppState("last_active_source", sourceId);
    this.emitContext("player");
  }

  async showLauncher(): Promise<void> {
    if (this.activeSourceId) {
      const active = SOURCES[this.activeSourceId];
      if (active) {
        await active.handleCommand({ type: "pause" });
      }
      this.hideView(this.activeSourceId);
      // Keep view alive for resume — do not destroy (architecture §7 / PRD §6.1)
    }
    this.activeSourceId = null;
    setAppState("last_active_source", "");
    this.emitContext("launcher");
  }

  private emitContext(mode: ContextMode): void {
    this.events.onContextChange({
      mode,
      activeSourceId: this.activeSourceId,
    });
  }

  private bindSourceInput(source: MediaSource, view: WebContentsView): void {
    if (!source.bindInput) return;

    source.bindInput({
      sendKey: async (keyCode: string): Promise<CommandResult> => {
        try {
          const contents = view.webContents;
          if (contents.isDestroyed()) {
            return { ok: false, reason: "no-active-session" };
          }
          // Window must be focused for sendInputEvent (Electron docs).
          if (!this.window.isFocused()) {
            this.window.focus();
          }
          contents.focus();
          const mapped = mapToElectronKeyCode(keyCode);
          contents.sendInputEvent({ type: "keyDown", keyCode: mapped });
          contents.sendInputEvent({ type: "keyUp", keyCode: mapped });
          return { ok: true };
        } catch (err) {
          console.error("[source-host] sendKey failed", err);
          return { ok: false, reason: "unknown" };
        }
      },
    });
  }

  private createView(source: MediaSource): WebContentsView {
    return new ElectronWebContentsView({
      webPreferences: {
        partition: source.sessionPartition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        plugins: true,
      },
    });
  }

  private attachView(view: WebContentsView): void {
    this.syncBounds(view);
    this.window.contentView.addChildView(view);
  }

  private hideView(sourceId: string): void {
    const view = this.views.get(sourceId);
    if (!view) return;
    this.window.contentView.removeChildView(view);
  }

  private syncActiveBounds(): void {
    const view = this.getActiveView();
    if (view) this.syncBounds(view);
  }

  private syncBounds(view: WebContentsView): void {
    const bounds = this.window.getContentBounds();
    // Leave a bottom chrome strip so the renderer can show toasts / Home.
    const chrome = 72;
    view.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: Math.max(0, bounds.height - chrome),
    });
  }
}

/** Map DOM-ish / UI key names → Electron accelerator keyCodes. */
function mapToElectronKeyCode(keyCode: string): string {
  switch (keyCode) {
    case "ArrowLeft":
    case "Left":
      return "Left";
    case "ArrowRight":
    case "Right":
      return "Right";
    case "ArrowUp":
    case "Up":
      return "Up";
    case "ArrowDown":
    case "Down":
      return "Down";
    case "Space":
    case " ":
      return "Space";
    case "KeyN":
    case "n":
    case "N":
      return "N";
    default:
      return keyCode.length === 1 ? keyCode.toUpperCase() : keyCode;
  }
}
