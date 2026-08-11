import type {
  CommandResult,
  MediaSource,
  RemoteCommand,
  SourceCapabilities,
  SourceIcon,
  SourceInput,
} from "@coosy/shared";
import { translateYoutubeCommand } from "./youtube-commands.js";

const CAPABILITIES: SourceCapabilities = {
  supportsSeek: true,
  // Next video needs Shift+N; SourceInput cannot send modifiers today.
  supportsNextEpisode: false,
  supportsNowPlayingMetadata: false,
  supportsVolume: true,
};

const ICON: SourceIcon = {
  src: "youtube",
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

  bindInput(input: SourceInput): void {
    this.input = input;
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
