/**
 * Active-source surface in the launcher renderer.
 *
 * The media WebContentsView is fullscreen in the main process. This component
 * intentionally renders no permanent chrome — toasts are a temporary overlay
 * window owned by main. Kept mounted so React unmounts HomeScreen work while
 * a source is active.
 */
export function PlayerOverlay({ sourceId }: { sourceId: string }) {
  return (
    <div
      className="player-surface"
      data-source={sourceId}
      aria-hidden="true"
    />
  );
}
