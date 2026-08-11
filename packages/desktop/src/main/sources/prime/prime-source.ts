import type {
  CommandResult,
  MediaSource,
  RemoteCommand,
  SourceCapabilities,
  SourceIcon,
  SourceInput,
} from "@coosy/shared";
import { translatePrimeCommand } from "./prime-commands.js";

const CAPABILITIES: SourceCapabilities = {
  supportsSeek: true,
  supportsNextEpisode: false,
  supportsNowPlayingMetadata: false,
  supportsVolume: true,
};

const ICON: SourceIcon = {
  src: "prime",
  alt: "Prime Video",
};

/**
 * ONLY place Prime Video-specific knowledge lives.
 */
export class PrimeSource implements MediaSource {
  readonly id = "prime";
  readonly displayName = "Prime Video";
  readonly homeUrl = "https://www.primevideo.com";
  readonly sessionPartition = "persist:prime";
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

    const keys = translatePrimeCommand(command);
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
