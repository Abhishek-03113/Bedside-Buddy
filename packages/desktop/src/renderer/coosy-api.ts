import type { NavAction, PlaybackHistoryItem, SourceCapabilities } from "@coosy/shared";

export type { PlaybackHistoryItem } from "@coosy/shared";

export interface SourceListItem {
  id: string;
  displayName: string;
  icon: { src: string; alt?: string };
  capabilities: SourceCapabilities;
}

export interface ConnectionInfo {
  ip: string | null;
  port: number;
  pairingCode: string;
  mdnsName: string;
  httpUrl: string | null;
  remoteError: string | null;
}

export interface CoosyRendererApi {
  listSources: () => Promise<SourceListItem[]>;
  openSource: (sourceId: string) => Promise<void>;
  listPlaybackHistory: () => Promise<PlaybackHistoryItem[]>;
  resumePlaybackHistory: (item: { sourceId: string; contentUrl: string }) => Promise<void>;
  showLauncher: () => Promise<void>;
  getConnectionInfo: () => Promise<ConnectionInfo>;
  onToast: (
    handler: (payload: { message: string; ok: boolean }) => void,
  ) => () => void;
  onNav: (handler: (action: NavAction) => void) => () => void;
  onContext: (
    handler: (payload: {
      mode: "launcher" | "player";
      activeSourceId: string | null;
    }) => void,
  ) => () => void;
}
