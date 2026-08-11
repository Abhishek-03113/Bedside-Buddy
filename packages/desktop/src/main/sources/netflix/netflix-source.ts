import type {
  CommandResult,
  MediaSource,
  RemoteCommand,
  SourceCapabilities,
  SourceIcon,
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
 */
export class NetflixSource implements MediaSource {
  readonly id = "netflix";
  readonly displayName = "Netflix";
  readonly homeUrl = "https://www.netflix.com";
  readonly sessionPartition = "persist:netflix";
  readonly icon = ICON;
  readonly capabilities = CAPABILITIES;

  private sendKey:
    | ((keyCode: string) => Promise<CommandResult>)
    | null = null;

  /** Wired by SourceHost / main once the active view is known */
  bindKeySender(sendKey: (keyCode: string) => Promise<CommandResult>): void {
    this.sendKey = sendKey;
  }

  async handleCommand(command: RemoteCommand): Promise<CommandResult> {
    if (!this.sendKey) {
      return { ok: false, reason: "no-active-session" };
    }

    const keys = translateNetflixCommand(command);
    if (!keys) {
      return { ok: false, reason: "unsupported" };
    }

    for (const key of keys) {
      const result = await this.sendKey(key);
      if (!result.ok) return result;
    }
    return { ok: true };
  }
}
