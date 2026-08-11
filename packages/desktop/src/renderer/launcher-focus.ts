import type { NavAction } from "@coosy/shared";

/**
 * Pure launcher focus helpers — renderer-owned, no Electron main coupling.
 * Navigation wraps so focus never becomes lost.
 */

export function resolveInitialFocusIndex(
  sourceIds: readonly string[],
  preferredSourceId: string | null | undefined,
): number {
  if (sourceIds.length === 0) return 0;
  if (preferredSourceId) {
    const idx = sourceIds.indexOf(preferredSourceId);
    if (idx >= 0) return idx;
  }
  return 0;
}

export function clampFocusIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

/**
 * Move focus on a CSS grid with `columns` columns (1-based width of a row).
 * Left/right wrap within the full list; up/down wrap by column stride.
 */
export function moveFocusIndex(
  current: number,
  action: Exclude<NavAction, "select" | "home" | "back">,
  length: number,
  columns: number,
): number {
  if (length <= 0) return 0;
  const cols = Math.max(1, columns);
  const index = clampFocusIndex(current, length);

  switch (action) {
    case "left":
      return (index - 1 + length) % length;
    case "right":
      return (index + 1) % length;
    case "up":
      return (index - cols + length) % length;
    case "down":
      return (index + cols) % length;
    default:
      return index;
  }
}

/** Count columns from a CSS `grid-template-columns` computed value. */
export function columnCountFromTemplate(gridTemplateColumns: string): number {
  const parts = gridTemplateColumns.trim().split(/\s+/).filter(Boolean);
  return Math.max(1, parts.length);
}
