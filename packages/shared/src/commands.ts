/**
 * Generic remote commands — never source-specific.
 * Phone → WebSocket → MediaSource.handleCommand
 */

export type RemoteCommand =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle-play-pause" }
  | { type: "seek"; deltaSeconds: number }
  | { type: "next-episode" }
  | { type: "volume"; direction: "up" | "down" };

export type CommandFailureReason =
  | "unsupported"
  | "no-active-session"
  | "unknown";

export type CommandResult =
  | { ok: true }
  | { ok: false; reason: CommandFailureReason };
