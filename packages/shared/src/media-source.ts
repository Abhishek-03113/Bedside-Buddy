import type { CommandResult, RemoteCommand } from "./commands.js";

/**
 * Declares what a source can actually do so infra/UI never assumes.
 */
export interface SourceCapabilities {
  supportsSeek: boolean;
  supportsNextEpisode: boolean;
  /** "Continue watching" / now-playing — optional and flaky; see architecture §4 */
  supportsNowPlayingMetadata: boolean;
  supportsVolume: boolean;
}

export interface SourceIcon {
  /** Absolute or package-relative path / data URL for launcher tile */
  src: string;
  alt?: string;
}

export interface NowPlayingInfo {
  title: string;
  subtitle?: string;
  artworkUrl?: string;
  progressSeconds?: number;
  durationSeconds?: number;
}

/**
 * The only seam between infra and a streaming platform.
 * Per-source code lives under packages/desktop/src/main/sources/.
 */
export interface MediaSource {
  readonly id: string;
  readonly displayName: string;
  readonly homeUrl: string;
  readonly sessionPartition: string;
  readonly icon: SourceIcon;
  readonly capabilities: SourceCapabilities;

  handleCommand(command: RemoteCommand): Promise<CommandResult>;

  /** Only present when capabilities.supportsNowPlayingMetadata is true */
  getNowPlaying?(): Promise<NowPlayingInfo | null>;
}
