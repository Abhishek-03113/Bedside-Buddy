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
  | { type: "volume"; direction: "up" | "down" }
  /** Scroll the active source page (browse context). */
  | { type: "scroll"; direction: "up" | "down" }
  /** Move focus among selectable media items on the active source. */
  | { type: "navigate"; direction: "up" | "down" | "left" | "right" }
  /** Activate / open / play the currently focused media item. */
  | { type: "activate" }
  /** Run a source search with the given query when the source supports it. */
  | { type: "search"; query: string };

export type CommandFailureReason =
  | "unsupported"
  | "no-active-session"
  | "unknown";

export type CommandResult =
  | { ok: true }
  | { ok: false; reason: CommandFailureReason };
