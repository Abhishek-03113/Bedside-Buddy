import { NetflixSource } from "./netflix/netflix-source.js";
import type { MediaSource } from "@coosy/shared";

/**
 * Deliberately not a plugin system — plain lookup table (architecture §5).
 * Adding a source = one new file + one line here.
 */
export const SOURCES: Record<string, MediaSource> = {
  netflix: new NetflixSource(),
};

export function listSources(): MediaSource[] {
  return Object.values(SOURCES);
}
