/**
 * Pure viewport math for source WebContentsView bounds.
 * Source surface owns the full content area — no permanent chrome reservation.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

/** True when the view has never navigated to a real source URL. */
export function isBlankSourceUrl(url: string | undefined | null): boolean {
  return !url || url === "about:blank";
}

/**
 * Content-relative bounds for an active media source.
 * Always full-bleed within the Electron content view.
 */
export function computeSourceViewportBounds(content: Size): Rect {
  const width = Math.max(0, Math.floor(content.width));
  const height = Math.max(0, Math.floor(content.height));
  return { x: 0, y: 0, width, height };
}

/**
 * Whether an existing view should be reused for this source id.
 */
export function shouldReuseSourceView(
  existingSourceIds: Iterable<string>,
  sourceId: string,
): boolean {
  for (const id of existingSourceIds) {
    if (id === sourceId) return true;
  }
  return false;
}

export type HostSurface = "launcher" | "source";

/**
 * Next surface + active source after a host transition request.
 */
export function nextHostState(
  current: { surface: HostSurface; activeSourceId: string | null },
  action:
    | { type: "show-source"; sourceId: string }
    | { type: "show-launcher" },
): { surface: HostSurface; activeSourceId: string | null; pauseSourceId: string | null } {
  if (action.type === "show-launcher") {
    return {
      surface: "launcher",
      activeSourceId: null,
      pauseSourceId: current.activeSourceId,
    };
  }

  const pauseSourceId =
    current.activeSourceId && current.activeSourceId !== action.sourceId
      ? current.activeSourceId
      : null;

  return {
    surface: "source",
    activeSourceId: action.sourceId,
    pauseSourceId,
  };
}
