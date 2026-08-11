import type { PlaybackHistoryItem } from "@coosy/shared";
import type { SourceListItem } from "./coosy-api";
import type { ContinueItem } from "./components/ContinueCard";

/** Keep the renderer source-agnostic while adapting generic history to the existing card. */
export function toContinueItems(
  history: PlaybackHistoryItem[],
  sources: SourceListItem[],
): ContinueItem[] {
  return history.flatMap((item) => {
    const source = sources.find((candidate) => candidate.id === item.sourceId);
    return source
      ? [{ ...item, title: item.title ?? item.contentUrl, sourceName: source.displayName, sourceIcon: source.icon.src }]
      : [];
  });
}
