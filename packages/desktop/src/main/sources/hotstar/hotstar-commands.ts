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
    default:
      return null;
  }
}
