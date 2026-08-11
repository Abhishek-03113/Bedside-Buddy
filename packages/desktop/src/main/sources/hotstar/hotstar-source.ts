import type {
  CommandResult,
  MediaSource,
  RemoteCommand,
  SourceCapabilities,
  SourceIcon,
  SourceInput,
} from "@coosy/shared";
import { translateHotstarCommand } from "./hotstar-commands.js";

const CAPABILITIES: SourceCapabilities = {
  supportsSeek: true,
  supportsNextEpisode: false,
  supportsNowPlayingMetadata: false,
  supportsVolume: true,
};

const ICON: SourceIcon = {
  src: "hotstar",
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

  bindInput(input: SourceInput): void {
    this.input = input;
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
