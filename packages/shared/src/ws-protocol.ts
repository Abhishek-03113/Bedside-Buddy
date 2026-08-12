import type { CommandResult, RemoteCommand } from "./commands.js";
import type { InputCommand } from "./input-commands.js";
import type { SourceCapabilities } from "./media-source.js";

/**
 * WebSocket message envelope between phone remote and desktop.
 * Source-agnostic — never carries Netflix/YouTube-specific fields.
 */

export type WsClientMessage =
  | { kind: "command"; requestId: string; command: RemoteCommand }
  /** Pointer / keyboard — routed to SourceHost, not MediaSource.handleCommand. */
  | { kind: "input"; requestId: string; command: InputCommand }
  | { kind: "hello"; clientId: string; pairingCode?: string }
  | { kind: "nav"; requestId: string; action: NavAction };

export type NavAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "back"
  | "home";

/** Minimal source list for the phone remote chrome — not a full catalog payload. */
export interface RemoteSourceSummary {
  id: string;
  displayName: string;
}

export type WsServerMessage =
  | {
      kind: "command-result";
      requestId: string;
      result: CommandResult;
    }
  | {
      kind: "hello-ack";
      sessionId: string;
      activeSourceId: string | null;
      capabilities: SourceCapabilities | null;
      mode: "launcher" | "player";
      sources: RemoteSourceSummary[];
    }
  | {
      kind: "context";
      mode: "launcher" | "player";
      activeSourceId: string | null;
      capabilities: SourceCapabilities | null;
      sources: RemoteSourceSummary[];
    }
  | {
      kind: "toast";
      message: string;
      ok: boolean;
    }
  | {
      kind: "cursor-position";
      x: number;
      y: number;
      viewWidth: number;
      viewHeight: number;
    }
  | {
      kind: "error";
      requestId?: string;
      message: string;
    };
