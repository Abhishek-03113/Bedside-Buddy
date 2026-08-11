interface SourceTileProps {
  id: string;
  displayName: string;
  icon: { src: string; alt?: string };
  focused?: boolean;
  index?: number;
  onSelect: () => void;
  onFocusRequest?: () => void;
}

/** Renders from MediaSource metadata only — no source-specific logic. */
export function SourceTile({
  id,
  displayName,
  icon,
  focused = false,
  index = 0,
  onSelect,
  onFocusRequest,
}: SourceTileProps) {
  return (
    <button
      type="button"
      className={`source-tile${focused ? " source-tile--focused" : ""}`}
      data-source-id={id}
      data-source-index={index}
      tabIndex={focused ? 0 : -1}
      aria-label={icon.alt ?? displayName}
      aria-pressed={focused}
      onClick={onSelect}
      onFocus={onFocusRequest}
    >
      <span className="source-tile__label">{displayName}</span>
    </button>
  );
}
