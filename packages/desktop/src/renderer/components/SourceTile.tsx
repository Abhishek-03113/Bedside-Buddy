interface SourceTileProps {
  id: string;
  displayName: string;
  icon: { src: string; alt?: string };
  onSelect: () => void;
}

/** Renders from MediaSource metadata only — no source-specific logic. */
export function SourceTile({ displayName, onSelect }: SourceTileProps) {
  return (
    <button type="button" className="source-tile" onClick={onSelect}>
      <span className="source-tile__label">{displayName}</span>
    </button>
  );
}
