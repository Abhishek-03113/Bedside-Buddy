import type { BrowserWindow, WebContentsView } from "electron";
import { WebContentsView as ElectronWebContentsView } from "electron";
import type { CommandResult, InputCommand, MediaSource } from "@coosy/shared";
import { SOURCES, listSources } from "./sources/registry.js";
import { touchSource, setAppState, upsertPlayback } from "./db/db.js";
import {
  computeSourceViewportBounds,
  isBlankSourceUrl,
  pauseSourcePlayback,
  rectsEqual,
  type Rect,
} from "./viewport.js";
import { perfInc } from "../shared/perf.js";
import { VirtualPointerController, type VirtualPointerTarget } from "./virtual-pointer.js";

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
  private readonly playbackHooks = new Map<string, () => void>();
  private readonly pausingSourceIds = new Set<string>();
  private activeSourceId: string | null = null;
  private resizeHandler: (() => void) | null = null;
  private boundInputSourceId: string | null = null;
  /** Last bounds successfully applied to the active view — skip identical setBounds. */
  private lastSyncedBounds: Rect | null = null;
  private readonly pointerController: VirtualPointerController;

  constructor(window: BrowserWindow, events: SourceHostEvents) {
    this.window = window;
    this.events = events;
    this.resizeHandler = () => this.syncActiveBounds();
    this.window.on("resize", this.resizeHandler);
    // macOS fullscreen transitions can change content size without a plain resize.
    this.window.on("enter-full-screen", this.resizeHandler);
    this.window.on("leave-full-screen", this.resizeHandler);
    this.pointerController = new VirtualPointerController(this.window);
    this.syncPointerTarget();
    perfInc("listener.register");
  }

  dispose(): void {
    if (this.resizeHandler) {
      this.window.removeListener("resize", this.resizeHandler);
      this.window.removeListener("enter-full-screen", this.resizeHandler);
      this.window.removeListener("leave-full-screen", this.resizeHandler);
      this.resizeHandler = null;
      perfInc("listener.cleanup");
    }
    for (const sourceId of [...this.views.keys()]) {
      this.detachView(sourceId);
      this.unbindEscapeHook(sourceId);
      this.unbindPlaybackHook(sourceId);
    }
    this.views.clear();
    this.attached.clear();
    this.activeSourceId = null;
    this.boundInputSourceId = null;
    this.lastSyncedBounds = null;
    this.pointerController.clearTarget();
    this.setLauncherThrottling(false);
  }

  getActiveSourceId(): string | null {
    return this.activeSourceId;
  }

  /**
   * Apply a generic pointer/keyboard command to the active source view.
   * Rejects cleanly when the launcher is showing (no active MediaSource).
   */
  handleInput(command: InputCommand): CommandResult {
    return this.pointerController.handleInput(command);
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
    perfInc("sourceHost.showSource");
    const source = SOURCES[sourceId];
    if (!source) {
      throw new Error(`Unknown source: ${sourceId}`);
    }

    // Idempotent: already showing this source and attached — avoid churn.
    if (this.activeSourceId === sourceId && this.attached.has(sourceId)) {
      const existing = this.views.get(sourceId);
      if (existing && !existing.webContents.isDestroyed()) {
        perfInc("sourceHost.showSource.noop");
        this.startLoadIfNeeded(existing, source);
        this.syncBounds(existing);
        return;
      }
    }

    // Same source but detached / recovering — reattach without DB rewrite if still active.
    if (this.activeSourceId === sourceId) {
      const existing = this.ensureLiveView(source);
      this.startLoadIfNeeded(existing, source);
      this.bindSourceInput(source, existing);
      this.bindEscapeHook(sourceId, existing);
      this.attachView(sourceId, existing);
      // Ensure pointer target is synchronized after reattachment/recreation.
      this.syncPointerTarget();
      this.syncBounds(existing);
      this.setLauncherThrottling(true);
      this.emitContext("player");
      return;
    }

    if (this.activeSourceId && this.activeSourceId !== sourceId) {
      this.recordPlayback(this.activeSourceId);
      this.pauseSourcePlayback(this.activeSourceId);
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
    this.syncPointerTarget();
    this.emitContext("player");
    this.startLoadIfNeeded(view, source);
  }

  /** Source-owned URL validation and navigation after normal retained-view activation. */
  async resumePlayback(sourceId: string, contentUrl: string): Promise<void> {
    const source = SOURCES[sourceId];
    if (!source) throw new Error(`Unknown source: ${sourceId}`);
    await this.showSource(source.id);
    await source.resumePlayback?.(contentUrl);
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
    // Idempotent: already on launcher.
    if (this.activeSourceId === null) {
      this.setLauncherThrottling(false);
      return;
    }

    this.recordPlayback(this.activeSourceId);
    this.pauseSourcePlayback(this.activeSourceId);
    this.detachView(this.activeSourceId);
    // Keep view alive for resume — do not destroy (architecture §7 / PRD §6.1)
    this.activeSourceId = null;
    this.lastSyncedBounds = null;
    setAppState("last_active_source", "");
    this.setLauncherThrottling(false);
    this.syncPointerTarget();
    this.emitContext("launcher");
  }

  /** Centralized pointer target synchronization. */
  private syncPointerTarget(): void {
    try {
      const target = this.getPointerTarget();
      this.pointerController.setTarget(target);
    } catch (err) {
      console.error('[source-host] syncPointerTarget failed', err);
    }
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
      this.unbindPlaybackHook(source.id);
      this.views.delete(source.id);
    }
    const view = this.createView(source);
    this.bindSourcePage(source, view);
    this.views.set(source.id, view);
    this.bindPlaybackHook(source.id, source, view);
    // A new/recreated view may be the pointer target — synchronize now.
    this.syncPointerTarget();
    return view;
  }

  private bindSourcePage(source: MediaSource, view: WebContentsView): void {
    source.bindPage?.({
      getUrl: () => view.webContents.getURL(),
      getTitle: () => view.webContents.getTitle(),
      navigate: async (url: string): Promise<void> => {
        await view.webContents.loadURL(url);
      },
    });
  }

  private bindPlaybackHook(sourceId: string, source: MediaSource, view: WebContentsView): void {
    if (this.playbackHooks.has(sourceId)) return;
    const hook = () => {
      if (this.activeSourceId === sourceId) this.recordPlayback(sourceId, source);
    };
    view.webContents.on("did-navigate", hook);
    view.webContents.on("did-navigate-in-page", hook);
    this.playbackHooks.set(sourceId, hook);
  }

  private unbindPlaybackHook(sourceId: string): void {
    const hook = this.playbackHooks.get(sourceId);
    const view = this.views.get(sourceId);
    if (hook && view && !view.webContents.isDestroyed()) {
      view.webContents.removeListener("did-navigate", hook);
      view.webContents.removeListener("did-navigate-in-page", hook);
    }
    this.playbackHooks.delete(sourceId);
  }

  private recordPlayback(sourceId: string, source = SOURCES[sourceId]): void {
    try {
      const item = source?.getCurrentPlaybackInfo?.();
      if (item) upsertPlayback(item);
    } catch (error) {
      console.warn(`[playback-history] ${sourceId} capture failed`, error);
    }
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
      pauseMedia: async (): Promise<CommandResult> => {
        try {
          if (this.boundInputSourceId !== source.id) {
            return { ok: false, reason: "no-active-session" };
          }
          const contents = view.webContents;
          if (contents.isDestroyed()) {
            return { ok: false, reason: "no-active-session" };
          }
          await contents.executeJavaScript(
            "document.querySelectorAll('video, audio').forEach((media) => media.pause())",
          );
          return { ok: true };
        } catch (err) {
          console.error("[source-host] pauseMedia failed", err);
          return { ok: false, reason: "no-active-session" };
        }
      },
    });
  }

  /** Start the idempotent pause before detaching without delaying the next paint. */
  private pauseSourcePlayback(sourceId: string): void {
    if (this.pausingSourceIds.has(sourceId)) return;
    this.pausingSourceIds.add(sourceId);
    void pauseSourcePlayback(SOURCES[sourceId]).finally(() => {
      this.pausingSourceIds.delete(sourceId);
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
    perfInc("listener.register");
  }

  private unbindEscapeHook(sourceId: string): void {
    const hook = this.inputHooks.get(sourceId);
    const view = this.views.get(sourceId);
    if (hook && view && !view.webContents.isDestroyed()) {
      view.webContents.removeListener("before-input-event", hook);
      perfInc("listener.cleanup");
    }
    this.inputHooks.delete(sourceId);
  }

  private createView(source: MediaSource): WebContentsView {
    perfInc("sourceHost.createView");
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

    // Diagnostic: log the user-agent for this source's WebContents.
    // The UA determines whether Netflix/DRM license servers treat this client
    // as a compatible browser.  This is a read-only diagnostic — no spoofing.
    // Prefix [netflix] when the partition is the Netflix session so it is easy
    // to grep in logs when diagnosing E100.
    const prefix = source.sessionPartition === "persist:netflix" ? "[netflix]" : `[source:${source.id}]`;
    console.log(`${prefix} user agent:`, view.webContents.getUserAgent());

    return view;
  }

  private attachView(sourceId: string, view: WebContentsView): void {
    this.syncBounds(view);
    if (this.attached.has(sourceId)) {
      // Already attached — avoid redundant addChildView when it is the sole media child.
      perfInc("sourceHost.showHide");
      return;
    }
    this.window.contentView.addChildView(view);
    this.attached.add(sourceId);
    perfInc("sourceHost.attach");
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
        perfInc("sourceHost.detach");
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
      this.pointerController.refreshTarget();
    }
  }

  private syncBounds(view: WebContentsView): void {
    // contentView bounds are the authoritative parent-relative size for child views.
    const content = this.window.contentView.getBounds();
    const next = computeSourceViewportBounds(content);
    if (rectsEqual(this.lastSyncedBounds, next)) {
      perfInc("sourceHost.setBounds.skipped");
      return;
    }
    view.setBounds(next);
    this.lastSyncedBounds = next;
    perfInc("sourceHost.setBounds");
  }

  private getPointerTarget(): VirtualPointerTarget | null {
    if (this.activeSourceId) {
      const view = this.getActiveView();
      if (!view || view.webContents.isDestroyed()) {
        return null;
      }
      return {
        id: this.activeSourceId,
        window: this.window,
        contents: view.webContents,
        getSize: (): { width: number; height: number } => {
          const bounds = view.getBounds();
          return {
            width: Math.max(1, bounds.width),
            height: Math.max(1, bounds.height),
          };
        },
      };
    }
    return {
      id: "launcher",
      window: this.window,
      contents: this.window.webContents,
      getSize: (): { width: number; height: number } => {
        const size = this.window.getContentSize();
        const width = typeof size[0] === "number" ? size[0] : 0;
        const height = typeof size[1] === "number" ? size[1] : 0;
        return { width, height };
      },
    };
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
    case "KeyJ":
    case "j":
    case "J":
      return "J";
    case "KeyK":
    case "k":
    case "K":
      return "K";
    case "KeyL":
    case "l":
    case "L":
      return "L";
    case "Enter":
    case "Return":
      return "Return";
    case "PageUp":
      return "PageUp";
    case "PageDown":
      return "PageDown";
    default:
      return keyCode.length === 1 ? keyCode.toUpperCase() : keyCode;
  }
}
