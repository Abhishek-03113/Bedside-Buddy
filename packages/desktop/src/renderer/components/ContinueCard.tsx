interface ContinueItem {
  title: string;
  subtitle?: string;
  sourceId: string;
  sourceName: string;
  artworkClass: string;
}

interface ContinueCardProps {
  items: ContinueItem[];
  onSelect?: (sourceId: string) => void;
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
          <li key={`${item.sourceId}-${item.title}`}>
            <button
              type="button"
              className={`continue-card ${item.artworkClass}`}
              onClick={() => onSelect?.(item.sourceId)}
            >
              <span className="continue-card__art" aria-hidden="true" />
              <span className="continue-card__details">
                <small>{item.sourceName}</small>
                <strong>{item.title}</strong>
                {item.subtitle ? <span>{item.subtitle}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
