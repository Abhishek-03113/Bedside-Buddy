import type { CommandResult, RemoteCommand } from "./commands.js";

/**
 * Declares what a source can actually do so infra/UI never assumes.
 */
export interface SourceCapabilities {
  supportsSeek: boolean;
  supportsNextEpisode: boolean;
  supportsVolume: boolean;
  /** Page / section scroll while browsing the source. */
  supportsScroll: boolean;
  /** Generic text search via RemoteCommand.search. */
  supportsSearch: boolean;
  /** D-pad focus movement + activate among media tiles. */
  supportsBrowseNavigate: boolean;
}

export interface SourceIcon {
  /** Absolute or package-relative path / data URL for launcher tile */
  src: string;
  alt?: string;
}

export interface PlaybackInfo {
  sourceId: string;
  contentUrl: string;
  title?: string;
  artworkUrl?: string;
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

/** Authenticated source page bridge; selectors and navigation stay in each source. */
export interface SourcePage {
  getUrl(): string;
  getTitle(): string;
  navigate(url: string): Promise<void>;
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

  /** Called when this source's authenticated WebContentsView is available. */
  bindPage?(page: SourcePage): void;

  /** Return the current normal content page when this source recognizes it as playable. */
  getCurrentPlaybackInfo?(): PlaybackInfo | null;

  /** Reopen a validated playback-history URL in this source's retained session. */
  resumePlayback?(contentUrl: string): Promise<void>;
}
