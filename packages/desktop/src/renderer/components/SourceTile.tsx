import { memo } from "react";
import { perfInc } from "../../shared/perf";

interface SourceTileProps {
  id: string;
  displayName: string;
  icon: { src: string; alt?: string };
  focused?: boolean;
  index?: number;
  onSelect: (id: string) => void;
  onFocusRequest?: (index: number) => void;
}

/**
 * Renders from MediaSource metadata only — no source-specific logic.
 * memo: focus changes only re-render the previously/newly focused tiles when
 * parent keeps onSelect / onFocusRequest referentially stable.
 */
export const SourceTile = memo(function SourceTile({
  id,
  displayName,
  icon,
  focused = false,
  index = 0,
  onSelect,
  onFocusRequest,
}: SourceTileProps) {
  perfInc("sourceTile.render");
  return (
    <button
      type="button"
      className={`source-tile${focused ? " source-tile--focused" : ""}`}
      data-source-id={id}
      data-source-index={index}
      tabIndex={focused ? 0 : -1}
      aria-label={icon.alt ?? displayName}
      aria-pressed={focused}
      onClick={() => onSelect(id)}
      onFocus={() => onFocusRequest?.(index)}
    >
      <span className={`source-tile__icon source-tile__icon--${id}`} aria-hidden="true">
        {id === "netflix" ? "N" : id === "prime" ? "▰" : id === "youtube" ? "▶" : "H"}
      </span>
      <span className="source-tile__label">{displayName}</span>
      <span className="source-tile__hint">Browse</span>
    </button>
  );
});
