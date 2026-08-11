/** CoOSy-owned, non-sensitive record of the last playable page per source. */
export interface PlaybackHistoryItem {
  id: number;
  sourceId: string;
  contentUrl: string;
  title?: string;
  artworkUrl?: string;
  lastPlayedAt: number;
  positionSeconds?: number;
  durationSeconds?: number;
}
