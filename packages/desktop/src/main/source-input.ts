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

import type { BrowserWindow, WebContentsView } from "electron";
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
  view: WebContentsView;
}

export interface PointerCursorState {
  x: number;
  y: number;
  /** True after the first move/click in a pointer session. */
  primed: boolean;
}

export function createPointerCursorState(): PointerCursorState {
  return { x: 0, y: 0, primed: false };
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

function viewSize(view: WebContentsView): { width: number; height: number } {
  const bounds = view.getBounds();
  return {
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Ensure cursor starts near the center of the active view on first pointer use.
 */
export function ensureCursorPrimed(
  cursor: PointerCursorState,
  view: WebContentsView,
): void {
  if (cursor.primed) return;
  const { width, height } = viewSize(view);
  cursor.x = Math.round(width / 2);
  cursor.y = Math.round(height / 2);
  cursor.primed = true;
}

function focusForInput(target: ActivePointerTarget): CommandResult | null {
  const { window, view } = target;
  const contents = view.webContents;
  if (contents.isDestroyed()) {
    return { ok: false, reason: "no-active-session" };
  }
  if (!window.isFocused()) {
    window.focus();
  }
  contents.focus();
  return null;
}

function applyMove(
  cursor: PointerCursorState,
  view: WebContentsView,
  dx: number,
  dy: number,
): void {
  ensureCursorPrimed(cursor, view);
  const { width, height } = viewSize(view);
  cursor.x = clamp(
    cursor.x + dx * POINTER_MOVE_SCALE,
    0,
    Math.max(0, width - 1),
  );
  cursor.y = clamp(
    cursor.y + dy * POINTER_MOVE_SCALE,
    0,
    Math.max(0, height - 1),
  );
}

/**
 * Apply one InputCommand to the active source view.
 */
export function applyInputCommand(
  target: ActivePointerTarget,
  cursor: PointerCursorState,
  command: InputCommand,
  focusSession?: { focused: boolean },
): CommandResult {
  const shouldFocus = command.type !== "pointer-move" || !focusSession?.focused;
  if (shouldFocus) {
    const focusErr = focusForInput(target);
    if (focusErr) return focusErr;
    if (focusSession) {
      focusSession.focused = true;
    }
  }

  const contents = target.view.webContents;
  const x = () => Math.round(cursor.x);
  const y = () => Math.round(cursor.y);

  try {
    switch (command.type) {
      case "pointer-move": {
        applyMove(cursor, target.view, command.dx, command.dy);
        contents.sendInputEvent({
          type: "mouseMove",
          x: x(),
          y: y(),
        });
        return { ok: true };
      }
      case "pointer-down": {
        ensureCursorPrimed(cursor, target.view);
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
        ensureCursorPrimed(cursor, target.view);
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
        ensureCursorPrimed(cursor, target.view);
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
        ensureCursorPrimed(cursor, target.view);
        const dx = (command.dx ?? 0) * POINTER_SCROLL_SCALE;
        const dy = command.dy * POINTER_SCROLL_SCALE;
        contents.sendInputEvent({
          type: "mouseWheel",
          x: x(),
          y: y(),
          deltaX: Math.round(-dx), // match Electron/Chromium convention used for deltaY above
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
