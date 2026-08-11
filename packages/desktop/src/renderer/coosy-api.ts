import type { NavAction, SourceCapabilities } from "@coosy/shared";

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
}

export interface CoosyRendererApi {
  listSources: () => Promise<SourceListItem[]>;
  openSource: (sourceId: string) => Promise<void>;
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
