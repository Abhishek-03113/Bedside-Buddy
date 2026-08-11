import type { PlaybackHistoryItem } from "@coosy/shared";

export interface ContinueItem extends PlaybackHistoryItem {
  sourceName: string;
  sourceIcon: string;
  title: string;
}

interface ContinueCardProps {
  items: ContinueItem[];
  onSelect?: (item: ContinueItem) => void;
}

/**
 * Presents resume cards supplied by the launcher. Empty list renders nothing.
 */
export function ContinueCard({ items, onSelect }: ContinueCardProps) {
  if (items.length === 0) return null;

  return (
    <section className="continue" aria-label="Continue watching">
      <div className="continue__heading">
        <span>Continue watching</span>
        <h2>Pick up where you left off.</h2>
      </div>
      <ul className="continue__grid">
        {items.map((item) => (
          <li key={`${item.sourceId}-${item.contentUrl}`}>
            <button
              type="button"
              className="continue-card"
              onClick={() => onSelect?.(item)}
            >
              {item.artworkUrl ? (
                <span className="continue-card__art" aria-hidden="true" style={{ backgroundImage: `url("${item.artworkUrl}")` }} />
              ) : (
                <span className="continue-card__art continue-card__art--logo" aria-hidden="true">
                  <img src={item.sourceIcon} alt="" />
                </span>
              )}
              <span className="continue-card__details">
                <small>{item.sourceName}</small>
                <strong>{item.title}</strong>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
