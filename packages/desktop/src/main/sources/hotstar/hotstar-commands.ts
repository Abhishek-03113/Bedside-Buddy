import type { RemoteCommand } from "@coosy/shared";

/**
 * Maps generic RemoteCommand → key codes for Disney+ Hotstar web player.
 *
 * Documented desktop shortcuts (player focus required):
 * - Space → play/pause
 * - ArrowLeft / ArrowRight → seek ≈10s
 * - ArrowUp / ArrowDown → volume
 * - No reliable next-episode keybind on the web player → unsupported
 *
 * Explicitly NOT Netflix's KeyN mapping.
 */
export function translateHotstarCommand(
  command: RemoteCommand,
): string[] | null {
  switch (command.type) {
    case "play":
    case "pause":
    case "toggle-play-pause":
      return ["Space"];
    case "seek":
      if (command.deltaSeconds > 0) return ["ArrowRight"];
      if (command.deltaSeconds < 0) return ["ArrowLeft"];
      return null;
    case "volume":
      return command.direction === "up" ? ["ArrowUp"] : ["ArrowDown"];
    case "next-episode":
      return null;
    case "scroll":
      return command.direction === "up" ? ["PageUp"] : ["PageDown"];
    case "navigate":
      switch (command.direction) {
        case "up":
          return ["ArrowUp"];
        case "down":
          return ["ArrowDown"];
        case "left":
          return ["ArrowLeft"];
        case "right":
          return ["ArrowRight"];
      }
      return null;
    case "select":
      return ["Enter"];
    case "search":
      return null;
    default:
      return null;
  }
}

/**
 * Hotstar web search URL is region/app dependent and not reliable enough
 * for a generic navigate — return null so handleCommand reports unsupported.
 */
export function hotstarSearchUrl(_query: string): string | null {
  return null;
}
