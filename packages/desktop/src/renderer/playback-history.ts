import type { PlaybackHistoryItem } from "@coosy/shared";

let cache: PlaybackHistoryItem[] = [];

export function getCachedPlaybackHistory(): PlaybackHistoryItem[] {
  return cache;
}

/** Home renders first; history loads in the background and replaces the session cache. */
export async function refreshPlaybackHistory(): Promise<PlaybackHistoryItem[]> {
  const items = await (window.coosy?.listPlaybackHistory() ?? Promise.resolve([]));
  cache = items;
  return items;
}

export function clearPlaybackHistoryCache(): void {
  cache = [];
}
