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
 * Input bridge supplied by SourceHost so sources can simulate keys
 * without knowing about Electron view lifecycle.
 */
export interface SourceInput {
  sendKey(keyCode: string): Promise<CommandResult>;
  /** Pause all media in the current source view without toggling playback. */
  pauseMedia(): Promise<CommandResult>;
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

  /** Stop playback when CoOSy leaves this source while retaining its view/session. */
  pausePlayback(): Promise<CommandResult>;

  /** Called when a view becomes available / is rebound after show */
  bindInput?(input: SourceInput): void;

  /** Only present when capabilities.supportsNowPlayingMetadata is true */
  getNowPlaying?(): Promise<NowPlayingInfo | null>;
}
