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
import { translateYoutubeCommand } from "./youtube-commands.js";

const CAPABILITIES: SourceCapabilities = {
  supportsSeek: true,
  // Next video needs Shift+N; SourceInput cannot send modifiers today.
  supportsNextEpisode: false,
  supportsVolume: true,
};

const ICON: SourceIcon = {
  src: "/assets/sources/youtube.svg",
  alt: "YouTube",
};

/**
 * ONLY place YouTube-specific knowledge lives.
 */
export class YoutubeSource implements MediaSource {
  readonly id = "youtube";
  readonly displayName = "YouTube";
  readonly homeUrl = "https://www.youtube.com";
  readonly sessionPartition = "persist:youtube";
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
    try {
      const url = new URL(contentUrl);
      return /(^|\.)youtube\.com$/.test(url.hostname)
        && url.pathname === "/watch" && url.searchParams.has("v")
        ? { sourceId: this.id, contentUrl, ...(this.page?.getTitle() ? { title: this.page.getTitle() } : {}) }
        : null;
    } catch {
      return null;
    }
  }

  async resumePlayback(contentUrl: string): Promise<void> {
    if (!this.getPlaybackUrl(contentUrl)) throw new Error("Invalid YouTube playback URL");
    await this.page?.navigate(contentUrl);
  }

  private getPlaybackUrl(contentUrl: string): boolean {
    try {
      const url = new URL(contentUrl);
      return /(^|\.)youtube\.com$/.test(url.hostname)
        && url.pathname === "/watch" && url.searchParams.has("v");
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

    const keys = translateYoutubeCommand(command);
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
