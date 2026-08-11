import type { NavAction, RemoteCommand } from "@coosy/shared";

export type RemoteMode = "launcher" | "player";

export type RemoteDispatch =
  | { kind: "nav"; action: NavAction }
  | { kind: "command"; command: RemoteCommand };

/**
 * Launcher: all D-pad / system keys go as nav (HomeScreen owns focus).
 * Player: Home/Back stay as nav (App returns to launcher); arrows/OK become
 * generic MediaSource commands so sources interpret browse/activate.
 */
export function resolveControlAction(
  mode: RemoteMode,
  action: NavAction,
): RemoteDispatch {
  if (action === "home" || action === "back") {
    return { kind: "nav", action };
  }
  if (mode === "launcher") {
    return { kind: "nav", action };
  }
  if (action === "select") {
    return { kind: "command", command: { type: "activate" } };
  }
  return {
    kind: "command",
    command: { type: "navigate", direction: action },
  };
}

export function feedbackLabel(
  message: string,
  ok: boolean | null = null,
): string {
  if (ok === false) return message.includes("failed") ? message : `${message} failed`;
  return message;
}

export const TOAST_DISMISS_MS = 1600;
