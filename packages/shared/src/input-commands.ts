/**
 * Generic pointer / keyboard intent from the phone remote.
 * Describes user intent — never Electron, DOM, or source-specific details.
 *
 * Handled by desktop infrastructure (SourceHost), not MediaSource.handleCommand.
 */

/** Minimal special keys for login / search / form navigation. */
export type RemoteKey =
  | "Backspace"
  | "Enter"
  | "Escape"
  | "Tab"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight";

export type PointerButton = "left" | "right" | "middle";

export type InputCommand =
  /** Relative pointer movement in logical remote units (desktop scales to view). */
  | { type: "pointer-move"; dx: number; dy: number }
  | { type: "pointer-down"; button?: PointerButton }
  | { type: "pointer-up"; button?: PointerButton }
  | { type: "pointer-click"; button?: PointerButton }
  /** Scroll deltas in logical remote units (positive dy = scroll down). */
  | { type: "pointer-scroll"; dx?: number; dy: number }
  | { type: "key-down"; key: RemoteKey }
  | { type: "key-up"; key: RemoteKey }
  /** Insert text into the currently focused field on the active source. */
  | { type: "text-input"; text: string };

export const INPUT_COMMAND_TYPES = [
  "pointer-move",
  "pointer-down",
  "pointer-up",
  "pointer-click",
  "pointer-scroll",
  "key-down",
  "key-up",
  "text-input",
] as const;

export type InputCommandType = (typeof INPUT_COMMAND_TYPES)[number];

export const REMOTE_KEYS: readonly RemoteKey[] = [
  "Backspace",
  "Enter",
  "Escape",
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
] as const;

const REMOTE_KEY_SET = new Set<string>(REMOTE_KEYS);
const POINTER_BUTTON_SET = new Set<string>(["left", "right", "middle"]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Narrow unknown JSON into InputCommand. Returns null when malformed.
 */
export function parseInputCommand(raw: unknown): InputCommand | null {
  if (!raw || typeof raw !== "object") return null;
  const cmd = raw as Record<string, unknown>;
  const type = cmd.type;
  if (typeof type !== "string") return null;

  switch (type) {
    case "pointer-move":
      if (!isFiniteNumber(cmd.dx) || !isFiniteNumber(cmd.dy)) return null;
      return { type, dx: cmd.dx, dy: cmd.dy };
    case "pointer-scroll": {
      if (!isFiniteNumber(cmd.dy)) return null;
      const dx = cmd.dx === undefined ? 0 : cmd.dx;
      if (!isFiniteNumber(dx)) return null;
      return { type, dx, dy: cmd.dy };
    }
    case "pointer-down":
    case "pointer-up":
    case "pointer-click": {
      const button = cmd.button === undefined ? "left" : cmd.button;
      if (typeof button !== "string" || !POINTER_BUTTON_SET.has(button)) {
        return null;
      }
      return { type, button: button as PointerButton };
    }
    case "key-down":
    case "key-up": {
      if (typeof cmd.key !== "string" || !REMOTE_KEY_SET.has(cmd.key)) {
        return null;
      }
      return { type, key: cmd.key as RemoteKey };
    }
    case "text-input":
      if (typeof cmd.text !== "string" || cmd.text.length === 0) return null;
      // Cap payload size to avoid abuse / runaway paste.
      if (cmd.text.length > 512) return null;
      return { type, text: cmd.text };
    default:
      return null;
  }
}
