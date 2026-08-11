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
    case "activate":
      return ["Enter"];
    case "search":
      return null;
    default:
      return null;
  }
}

/** Prime Video search URL — only place this path knowledge lives. */
export function primeSearchUrl(query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  return `https://www.primevideo.com/search?phrase=${encodeURIComponent(q)}`;
}
