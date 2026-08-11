import { NetflixSource } from "./netflix/netflix-source.js";
import { YoutubeSource } from "./youtube/youtube-source.js";
import { HotstarSource } from "./hotstar/hotstar-source.js";
import { PrimeSource } from "./prime/prime-source.js";
import type { MediaSource } from "@coosy/shared";

/**
 * Deliberately not a plugin system — plain lookup table (architecture §5).
 * Adding a source = one new folder + one line here.
 */
export const SOURCES: Record<string, MediaSource> = {
  netflix: new NetflixSource(),
  youtube: new YoutubeSource(),
  hotstar: new HotstarSource(),
  prime: new PrimeSource(),
};

export function listSources(): MediaSource[] {
  return Object.values(SOURCES);
}
