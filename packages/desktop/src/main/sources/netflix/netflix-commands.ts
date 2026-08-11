import type { RemoteCommand } from "@coosy/shared";

/**
 * Maps generic RemoteCommand → Netflix keyboard events.
 * This is the ONLY place that knows Netflix keybinds.
 */
export function translateNetflixCommand(
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
    case "next-episode":
      // Netflix "next episode" is often 'N' or a UI click; Space/keys vary.
      // Baseline: 'N' — revisit when validating against a live player.
      return ["KeyN"];
    case "volume":
      return command.direction === "up" ? ["ArrowUp"] : ["ArrowDown"];
    default:
      return null;
  }
}
