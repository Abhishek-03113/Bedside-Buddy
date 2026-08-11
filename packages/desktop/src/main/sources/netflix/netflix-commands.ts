import type { RemoteCommand } from "@coosy/shared";

/**
 * Maps generic RemoteCommand → key codes for Netflix.
 * Values are mapped again in SourceHost to Electron accelerator names.
 *
 * Live-player notes (POC):
 * - Space is the reliable play/pause baseline across Netflix redesigns.
 * - Arrow seek/volume work when the player has keyboard focus; first command
 *   after load may need a prior click (trackpad mode — deferred).
 * - KeyN for next-episode is best-effort; Netflix sometimes uses UI-only.
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
      return ["KeyN"];
    case "volume":
      return command.direction === "up" ? ["ArrowUp"] : ["ArrowDown"];
    default:
      return null;
  }
}
