interface ContinueItem {
  title: string;
  subtitle?: string;
  sourceId: string;
}

interface ContinueCardProps {
  items: ContinueItem[];
}

/**
 * Only meaningful when supportsNowPlayingMetadata is true for a source.
 * Empty list → render nothing (no stubs, no fake data).
 */
export function ContinueCard({ items }: ContinueCardProps) {
  if (items.length === 0) return null;

  return (
    <section className="continue" aria-label="Continue watching">
      <h2>Continue watching</h2>
      <ul>
        {items.map((item) => (
          <li key={`${item.sourceId}-${item.title}`}>
            <strong>{item.title}</strong>
            {item.subtitle ? <span> — {item.subtitle}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
