import type { RemoteCommand } from "@coosy/shared";

/**
 * Maps generic RemoteCommand → key codes for Prime Video web player.
 *
 * Official Prime Video shortcuts (player focus required):
 * - Space → play/pause
 * - ArrowLeft / ArrowRight → seek ±10s
 * - ArrowUp / ArrowDown → volume
 * - No documented next-episode key → unsupported
 */
export function translatePrimeCommand(
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
