import type {
  CommandResult,
  MediaSource,
  RemoteCommand,
  SourceCapabilities,
  SourceIcon,
  SourceInput,
} from "@coosy/shared";
import { translateNetflixCommand } from "./netflix-commands.js";

const CAPABILITIES: SourceCapabilities = {
  supportsSeek: true,
  supportsNextEpisode: true,
  supportsNowPlayingMetadata: false, // honest v1 — architecture §4
  supportsVolume: true,
};

const ICON: SourceIcon = {
  src: "netflix",
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

  bindInput(input: SourceInput): void {
    this.input = input;
  }

  async handleCommand(command: RemoteCommand): Promise<CommandResult> {
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
