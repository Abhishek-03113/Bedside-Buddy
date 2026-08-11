import type { CommandResult, RemoteCommand } from "./commands.js";
import type { SourceCapabilities } from "./media-source.js";

/**
 * WebSocket message envelope between phone remote and desktop.
 * Source-agnostic — never carries Netflix/YouTube-specific fields.
 */

export type WsClientMessage =
  | { kind: "command"; requestId: string; command: RemoteCommand }
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
    }
  | {
      kind: "context";
      mode: "launcher" | "player";
      activeSourceId: string | null;
      capabilities: SourceCapabilities | null;
    }
  | {
      kind: "toast";
      message: string;
      ok: boolean;
    }
  | {
      kind: "error";
      requestId?: string;
      message: string;
    };
