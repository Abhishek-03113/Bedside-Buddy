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
import {
  netflixSearchUrl,
  translateNetflixCommand,
} from "./netflix-commands.js";

const CAPABILITIES: SourceCapabilities = {
  supportsSeek: true,
  supportsNextEpisode: true,
  supportsVolume: true,
  supportsScroll: true,
  supportsSearch: true,
  supportsBrowseNavigate: true,
};

const ICON: SourceIcon = {
  src: "/assets/sources/netflix.svg",
  alt: "Netflix",
};

/**
 * ONLY place Netflix-specific knowledge lives.
 *
 * Keybinds (validated against Netflix HTML5 player conventions):
 * - Space → play/pause
 * - Left / Right → seek ~10s (player-dependent)
 * - Up / Down → volume
 * - N → next episode (when the player exposes it; may no-op on some screens)
 */
export class NetflixSource implements MediaSource {
  readonly id = "netflix";
  readonly displayName = "Netflix";
  readonly homeUrl = "https://www.netflix.com";
  readonly sessionPartition = "persist:netflix";
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
    return /^https:\/\/(www\.)?netflix\.com\/watch\//.test(contentUrl)
      ? { sourceId: this.id, contentUrl, ...(this.page?.getTitle() ? { title: this.page.getTitle() } : {}) }
      : null;
  }

  async resumePlayback(contentUrl: string): Promise<void> {
    if (!/^https:\/\/(www\.)?netflix\.com\/watch\//.test(contentUrl)) {
      throw new Error("Invalid Netflix playback URL");
    }
    await this.page?.navigate(contentUrl);
  }

  async pausePlayback(): Promise<CommandResult> {
    return this.input?.pauseMedia() ?? { ok: false, reason: "no-active-session" };
  }

  async handleCommand(command: RemoteCommand): Promise<CommandResult> {
    if (command.type === "search") {
      const url = netflixSearchUrl(command.query);
      if (!url) return { ok: false, reason: "unsupported" };
      if (!this.page) return { ok: false, reason: "no-active-session" };
      await this.page.navigate(url);
      return { ok: true };
    }

    if (!this.input) {
      return { ok: false, reason: "no-active-session" };
    }

    const keys = translateNetflixCommand(command);
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
