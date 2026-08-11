import type {
  CommandResult,
  MediaSource,
  RemoteCommand,
  SourceCapabilities,
  SourceIcon,
  SourceInput,
  SourcePage,
  PlaybackInfo,
} from "@coosy/shared";
import { translateHotstarCommand } from "./hotstar-commands.js";

const CAPABILITIES: SourceCapabilities = {
  supportsSeek: true,
  supportsNextEpisode: false,
  supportsVolume: true,
};

const ICON: SourceIcon = {
  src: "/assets/sources/hotstar.svg",
  alt: "Hotstar",
};

/**
 * ONLY place Hotstar-specific knowledge lives.
 */
export class HotstarSource implements MediaSource {
  readonly id = "hotstar";
  readonly displayName = "Hotstar";
  readonly homeUrl = "https://www.hotstar.com";
  readonly sessionPartition = "persist:hotstar";
  readonly icon = ICON;
  readonly capabilities = CAPABILITIES;

  private input: SourceInput | null = null;
  private page: SourcePage | null = null;

  bindInput(input: SourceInput): void {
    this.input = input;
  }

  bindPage(page: SourcePage): void {
    this.page = page;
  }

  getCurrentPlaybackInfo(): PlaybackInfo | null {
    const contentUrl = this.page?.getUrl() ?? "";
    return this.isPlaybackUrl(contentUrl)
      ? { sourceId: this.id, contentUrl, ...(this.page?.getTitle() ? { title: this.page.getTitle() } : {}) }
      : null;
  }

  async resumePlayback(contentUrl: string): Promise<void> {
    if (!this.isPlaybackUrl(contentUrl)) throw new Error("Invalid Hotstar playback URL");
    await this.page?.navigate(contentUrl);
  }

  private isPlaybackUrl(contentUrl: string): boolean {
    try {
      const url = new URL(contentUrl);
      return /(^|\.)hotstar\.com$/.test(url.hostname)
        && /\/(movies|shows|sports)\//.test(url.pathname);
    } catch {
      return false;
    }
  }

  async pausePlayback(): Promise<CommandResult> {
    return this.input?.pauseMedia() ?? { ok: false, reason: "no-active-session" };
  }

  async handleCommand(command: RemoteCommand): Promise<CommandResult> {
    if (!this.input) {
      return { ok: false, reason: "no-active-session" };
    }

    const keys = translateHotstarCommand(command);
    if (!keys) {
      return { ok: false, reason: "unsupported" };
    }

    for (const key of keys) {
      const result = await this.input.sendKey(key);
      if (!result.ok) return result;
    }
    return { ok: true };
  }
}
