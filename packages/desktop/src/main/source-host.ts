import type { BrowserWindow, WebContentsView } from "electron";
import { WebContentsView as ElectronWebContentsView } from "electron";
import type { CommandResult, MediaSource } from "@coosy/shared";
import { SOURCES, listSources } from "./sources/registry.js";
import { touchSource, setAppState } from "./db/db.js";
import { computeSourceViewportBounds, isBlankSourceUrl } from "./viewport.js";

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
  private readonly attached = new Set<string>();
  private readonly inputHooks = new Map<string, (event: Electron.Event, input: Electron.Input) => void>();
  private activeSourceId: string | null = null;
  private resizeHandler: (() => void) | null = null;
  private boundInputSourceId: string | null = null;

  constructor(window: BrowserWindow, events: SourceHostEvents) {
    this.window = window;
    this.events = events;
    this.resizeHandler = () => this.syncActiveBounds();
    this.window.on("resize", this.resizeHandler);
    // macOS fullscreen transitions can change content size without a plain resize.
    this.window.on("enter-full-screen", this.resizeHandler);
    this.window.on("leave-full-screen", this.resizeHandler);
  }

  dispose(): void {
    if (this.resizeHandler) {
      this.window.removeListener("resize", this.resizeHandler);
      this.window.removeListener("enter-full-screen", this.resizeHandler);
      this.window.removeListener("leave-full-screen", this.resizeHandler);
      this.resizeHandler = null;
    }
    for (const sourceId of [...this.views.keys()]) {
      this.detachView(sourceId);
      this.unbindEscapeHook(sourceId);
    }
    this.views.clear();
    this.attached.clear();
    this.activeSourceId = null;
    this.boundInputSourceId = null;
    this.setLauncherThrottling(false);
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

  /** Test/diagnostic seam — live view ids currently retained. */
  getRetainedSourceIds(): string[] {
    return [...this.views.keys()];
  }

  async showSource(sourceId: string): Promise<void> {
    const source = SOURCES[sourceId];
    if (!source) {
      throw new Error(`Unknown source: ${sourceId}`);
    }

    // Idempotent reopen of the already-visible source.
    if (this.activeSourceId === sourceId) {
      const existing = this.ensureLiveView(source);
      this.startLoadIfNeeded(existing, source);
      this.bindSourceInput(source, existing);
      this.bindEscapeHook(sourceId, existing);
      this.attachView(sourceId, existing);
      this.syncBounds(existing);
      this.setLauncherThrottling(true);
      this.emitContext("player");
      return;
    }

    if (this.activeSourceId && this.activeSourceId !== sourceId) {
      const previous = SOURCES[this.activeSourceId];
      if (previous) {
        // Don't block the switch on pause round-trip.
        void previous.handleCommand({ type: "pause" });
      }
      this.detachView(this.activeSourceId);
    }

    const view = this.ensureLiveView(source);
    // Attach immediately — never wait for Netflix's full document load.
    // Cold loads paint inside the WebContentsView; warm loads are instant.
    this.bindSourceInput(source, view);
    this.bindEscapeHook(sourceId, view);
    this.attachView(sourceId, view);
    this.activeSourceId = sourceId;
    touchSource(sourceId);
    setAppState("last_active_source", sourceId);
    this.setLauncherThrottling(true);
    this.emitContext("player");
    this.startLoadIfNeeded(view, source);
  }

  /**
   * Create + navigate source views in the background while the launcher is up.
   * First tile click should then be attach-only, not a cold Netflix navigation.
   */
  warmSources(): void {
    for (const source of listSources()) {
      const view = this.ensureLiveView(source);
      this.bindEscapeHook(source.id, view);
      this.startLoadIfNeeded(view, source);
    }
  }

  private startLoadIfNeeded(view: WebContentsView, source: MediaSource): void {
    if (view.webContents.isDestroyed()) return;
    if (!isBlankSourceUrl(view.webContents.getURL())) return;
    if (view.webContents.isLoading()) return;

    void view.webContents.loadURL(source.homeUrl).catch((err) => {
      console.error(`[source-host] failed to load ${source.id}`, err);
    });
  }

  async showLauncher(): Promise<void> {
    if (this.activeSourceId) {
      const active = SOURCES[this.activeSourceId];
      if (active) {
        void active.handleCommand({ type: "pause" });
      }
      this.detachView(this.activeSourceId);
      // Keep view alive for resume — do not destroy (architecture §7 / PRD §6.1)
    }
    this.activeSourceId = null;
    setAppState("last_active_source", "");
    this.setLauncherThrottling(false);
    this.emitContext("launcher");
  }

  private emitContext(mode: ContextMode): void {
    this.events.onContextChange({
      mode,
      activeSourceId: this.activeSourceId,
    });
  }

  private ensureLiveView(source: MediaSource): WebContentsView {
    const existing = this.views.get(source.id);
    if (existing && !existing.webContents.isDestroyed()) {
      return existing;
    }
    if (existing) {
      this.detachView(source.id);
      this.unbindEscapeHook(source.id);
      this.views.delete(source.id);
    }
    const view = this.createView(source);
    this.views.set(source.id, view);
    return view;
  }

  private bindSourceInput(source: MediaSource, view: WebContentsView): void {
    if (!source.bindInput) return;
    // Rebinding every show replaces the previous closure — required after view recreate.
    this.boundInputSourceId = source.id;
    source.bindInput({
      sendKey: async (keyCode: string): Promise<CommandResult> => {
        try {
          if (this.boundInputSourceId !== source.id) {
            return { ok: false, reason: "no-active-session" };
          }
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

  private bindEscapeHook(sourceId: string, view: WebContentsView): void {
    if (this.inputHooks.has(sourceId)) return;

    const hook = (event: Electron.Event, input: Electron.Input) => {
      if (input.type !== "keyDown") return;
      // Don't steal bare Escape (Netflix uses it). Cmd/Ctrl+Escape → CoOSy home.
      if (input.key !== "Escape") return;
      if (!(input.meta || input.control)) return;
      if (this.activeSourceId !== sourceId) return;
      event.preventDefault();
      void this.showLauncher();
    };

    view.webContents.on("before-input-event", hook);
    this.inputHooks.set(sourceId, hook);
  }

  private unbindEscapeHook(sourceId: string): void {
    const hook = this.inputHooks.get(sourceId);
    const view = this.views.get(sourceId);
    if (hook && view && !view.webContents.isDestroyed()) {
      view.webContents.removeListener("before-input-event", hook);
    }
    this.inputHooks.delete(sourceId);
  }

  private createView(source: MediaSource): WebContentsView {
    const view = new ElectronWebContentsView({
      webPreferences: {
        partition: source.sessionPartition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        plugins: true,
        backgroundThrottling: false,
      },
    });
    // Opaque under-page color avoids flashes of the launcher through the source.
    view.setBackgroundColor("#000000");
    return view;
  }

  private attachView(sourceId: string, view: WebContentsView): void {
    this.syncBounds(view);
    if (this.attached.has(sourceId)) {
      // Re-add moves the child to the top of the z-order.
      this.window.contentView.addChildView(view);
    } else {
      this.window.contentView.addChildView(view);
      this.attached.add(sourceId);
    }
    // Fullscreen enter can settle after the first paint — resync once.
    setImmediate(() => {
      if (this.activeSourceId === sourceId && !view.webContents.isDestroyed()) {
        this.syncBounds(view);
      }
    });
  }

  private detachView(sourceId: string): void {
    const view = this.views.get(sourceId);
    if (!view) return;
    if (this.attached.has(sourceId)) {
      try {
        this.window.contentView.removeChildView(view);
      } catch {
        // View may already be detached during window teardown.
      }
      this.attached.delete(sourceId);
    }
  }

  private syncActiveBounds(): void {
    const view = this.getActiveView();
    if (view && !view.webContents.isDestroyed()) {
      this.syncBounds(view);
    }
  }

  private syncBounds(view: WebContentsView): void {
    // contentView bounds are the authoritative parent-relative size for child views.
    const content = this.window.contentView.getBounds();
    view.setBounds(computeSourceViewportBounds(content));
  }

  private setLauncherThrottling(enabled: boolean): void {
    const contents = this.window.webContents;
    if (!contents || contents.isDestroyed()) return;
    // While a source owns the screen, the launcher renderer should not keep painting.
    contents.setBackgroundThrottling(enabled);
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
