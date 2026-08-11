interface SourceTileProps {
  id: string;
  displayName: string;
  icon: { src: string; alt?: string };
  focused?: boolean;
  index?: number;
  onSelect: () => void;
}

/** Renders from MediaSource metadata only — no source-specific logic. */
export function SourceTile({
  displayName,
  focused = false,
  index = 0,
  onSelect,
}: SourceTileProps) {
  return (
    <button
      type="button"
      className={`source-tile${focused ? " source-tile--focused" : ""}`}
      data-source-index={index}
      aria-pressed={focused}
      onClick={onSelect}
    >
      <span className="source-tile__label">{displayName}</span>
    </button>
  );
}
