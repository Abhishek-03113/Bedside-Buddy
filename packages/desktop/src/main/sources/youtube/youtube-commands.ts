import type { RemoteCommand } from "@coosy/shared";

/**
 * Maps generic RemoteCommand → key codes for YouTube.
 * Values are mapped again in SourceHost to Electron accelerator names.
 *
 * Official YouTube shortcuts (player must have focus):
 * - K → play/pause (more reliable than Space, which needs seek-bar focus)
 * - J / L → seek ±10s
 * - ArrowUp / ArrowDown → volume
 * - Shift+N → next video — NOT mapped: SourceInput is single-key only,
 *   so next-episode is declared unsupported in capabilities.
 */
export function translateYoutubeCommand(
  command: RemoteCommand,
): string[] | null {
  switch (command.type) {
    case "play":
    case "pause":
    case "toggle-play-pause":
      return ["KeyK"];
    case "seek":
      if (command.deltaSeconds > 0) return ["KeyL"];
      if (command.deltaSeconds < 0) return ["KeyJ"];
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

/** YouTube search results URL — only place this path knowledge lives. */
export function youtubeSearchUrl(query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
