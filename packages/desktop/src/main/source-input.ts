/**
 * Translate generic InputCommand → Electron sendInputEvent / insertText
 * against the active source WebContentsView.
 *
 * SOURCE-AGNOSTIC — never branches on Netflix / YouTube / etc.
 *
 * Platform notes (cursor / coordinates):
 * - Events are injected into the WebContentsView only; the OS cursor is not moved.
 * - Coordinates are view-local (origin = top-left of the active source bounds).
 * - Electron requires the BrowserWindow to be focused for reliable delivery.
 * - insertText targets the currently focused DOM element inside the source page;
 *   the user must focus a field (via trackpad) before typing.
 */

import type { BrowserWindow, WebContents } from "electron";
import type {
  CommandResult,
  InputCommand,
  PointerButton,
  RemoteKey,
} from "@coosy/shared";

/** Scale remote finger deltas → view pixels. Tuned for phone thumb travel. */
export const POINTER_MOVE_SCALE = 1.35;
/** Scale remote scroll deltas → wheel pixels. */
export const POINTER_SCROLL_SCALE = 2.5;

export interface ActivePointerTarget {
  window: BrowserWindow;
  contents: WebContents;
  getSize(): {
    width: number;
    height: number;
  };
}

export interface CursorState {
  x: number;
  y: number;
  /** True after the pointer has been initialized for a target. */
  primed: boolean;
  focused: boolean;
}

function buttonToElectron(button: PointerButton | undefined): "left" | "right" | "middle" {
  return button ?? "left";
}

function mapRemoteKey(key: RemoteKey): string {
  switch (key) {
    case "ArrowLeft":
      return "Left";
    case "ArrowRight":
      return "Right";
    case "ArrowUp":
      return "Up";
    case "ArrowDown":
      return "Down";
    case "Enter":
      return "Return";
    case "Backspace":
      return "Backspace";
    case "Escape":
      return "Escape";
    case "Tab":
      return "Tab";
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

function viewSize(target: ActivePointerTarget): { width: number; height: number } {
  return target.getSize();
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Ensure cursor starts near the center of the active view on first pointer use.
 */
export function ensureCursorPrimed(
  cursor: CursorState,
  target: ActivePointerTarget,
): void {
  if (cursor.primed) return;
  const { width, height } = viewSize(target);
  cursor.x = Math.round(width / 2);
  cursor.y = Math.round(height / 2);
  cursor.primed = true;
}

export function focusForInput(target: ActivePointerTarget, cursor: CursorState): CommandResult | null {
  const { window, contents } = target;
  if (contents.isDestroyed()) {
    return { ok: false, reason: "no-active-session" };
  }
  if (cursor.focused) return null;
  if (!window.isFocused()) {
    window.focus();
  }
  contents.focus();
  cursor.focused = true;
  return null;
}

function applyMove(
  cursor: CursorState,
  target: ActivePointerTarget,
  dx: number,
  dy: number,
  pointerMoveScale: number,
): void {
  ensureCursorPrimed(cursor, target);
  const { width, height } = viewSize(target);
  cursor.x = clamp(
    cursor.x + dx * pointerMoveScale,
    0,
    Math.max(0, width - 1),
  );
  cursor.y = clamp(
    cursor.y + dy * pointerMoveScale,
    0,
    Math.max(0, height - 1),
  );
}

/**
 * Apply one InputCommand to the active source view.
 */
export function applyInputCommand(
  target: ActivePointerTarget,
  cursor: CursorState,
  command: InputCommand,
  opts?: { pointerMoveScale?: number },
): CommandResult {
  const pointerMoveScale = opts?.pointerMoveScale ?? POINTER_MOVE_SCALE;
  const commandRequiresFocus =
    command.type === "pointer-down" ||
    command.type === "pointer-up" ||
    command.type === "pointer-click" ||
    command.type === "key-down" ||
    command.type === "key-up" ||
    command.type === "text-input";
  if (commandRequiresFocus) {
    const focusErr = focusForInput(target, cursor);
    if (focusErr) return focusErr;
  }

  const contents = target.contents;
  const x = () => Math.round(cursor.x);
  const y = () => Math.round(cursor.y);

  try {
    switch (command.type) {
          case "pointer-move": {
        applyMove(cursor, target, command.dx, command.dy, pointerMoveScale);
        contents.sendInputEvent({
          type: "mouseMove",
          x: x(),
          y: y(),
        });
        return { ok: true };
      }
      case "pointer-down": {
        ensureCursorPrimed(cursor, target);
        contents.sendInputEvent({
          type: "mouseDown",
          x: x(),
          y: y(),
          button: buttonToElectron(command.button),
          clickCount: 1,
        });
        return { ok: true };
      }
      case "pointer-up": {
        ensureCursorPrimed(cursor, target);
        contents.sendInputEvent({
          type: "mouseUp",
          x: x(),
          y: y(),
          button: buttonToElectron(command.button),
          clickCount: 1,
        });
        return { ok: true };
      }
      case "pointer-click": {
        ensureCursorPrimed(cursor, target);
        const button = buttonToElectron(command.button);
        contents.sendInputEvent({
          type: "mouseDown",
          x: x(),
          y: y(),
          button,
          clickCount: 1,
        });
        contents.sendInputEvent({
          type: "mouseUp",
          x: x(),
          y: y(),
          button,
          clickCount: 1,
        });
        return { ok: true };
      }
      case "pointer-scroll": {
        ensureCursorPrimed(cursor, target);
        const dx = (command.dx ?? 0) * POINTER_SCROLL_SCALE;
        const dy = command.dy * POINTER_SCROLL_SCALE;
        contents.sendInputEvent({
          type: "mouseWheel",
          x: x(),
          y: y(),
          deltaX: Math.round(dx),
          deltaY: Math.round(-dy), // Electron: positive deltaY scrolls up
        });
        return { ok: true };
      }
      case "key-down": {
        contents.sendInputEvent({
          type: "keyDown",
          keyCode: mapRemoteKey(command.key),
        });
        return { ok: true };
      }
      case "key-up": {
        contents.sendInputEvent({
          type: "keyUp",
          keyCode: mapRemoteKey(command.key),
        });
        return { ok: true };
      }
      case "text-input": {
        contents.insertText(command.text);
        return { ok: true };
      }
      default: {
        const _exhaustive: never = command;
        return _exhaustive;
      }
    }
  } catch (err) {
    console.error("[source-input] applyInputCommand failed", err);
    return { ok: false, reason: "unknown" };
  }
}
