import type { BrowserWindow, WebContentsView } from "electron";
import { WebContentsView as ElectronWebContentsView } from "electron";
import { SOURCES } from "./sources/registry.js";
import type { MediaSource } from "@coosy/shared";

/**
 * Owns WebContentsView lifecycle and session partitions.
 * SOURCE-AGNOSTIC — never branches on Netflix / YouTube / etc.
 */
export class SourceHost {
  private readonly window: BrowserWindow;
  private readonly views = new Map<string, WebContentsView>();
  private activeSourceId: string | null = null;

  constructor(window: BrowserWindow) {
    this.window = window;
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

    // Pause previous source before switch (PRD flow C)
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

    this.attachView(view);
    this.activeSourceId = sourceId;
  }

  showLauncher(): void {
    if (this.activeSourceId) {
      this.hideView(this.activeSourceId);
      // Keep view alive for resume — do not destroy (architecture §7 / PRD §6.1)
    }
    this.activeSourceId = null;
  }

  private createView(source: MediaSource): WebContentsView {
    const view = new ElectronWebContentsView({
      webPreferences: {
        partition: source.sessionPartition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    return view;
  }

  private attachView(view: WebContentsView): void {
    const bounds = this.window.getContentBounds();
    view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    this.window.contentView.addChildView(view);
  }

  private hideView(sourceId: string): void {
    const view = this.views.get(sourceId);
    if (!view) return;
    this.window.contentView.removeChildView(view);
  }
}
