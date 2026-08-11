import type { InputCommand } from "@coosy/shared";

export type RemoteInputMode = "dpad" | "trackpad";

/**
 * Coalesce high-frequency pointer-move / pointer-scroll into one outbound
 * command per animation frame. Clicks and keys must NOT use this path.
 */
export function createPointerCoalescer(opts: {
  send: (command: InputCommand) => void;
  /** Max wait before flushing even without rAF (ms). Default 16. */
  maxIntervalMs?: number;
  /** Returns false when sending must stop (disconnect). */
  isActive?: () => boolean;
}): {
  move: (dx: number, dy: number) => void;
  scroll: (dx: number, dy: number) => void;
  flush: () => void;
  clear: () => void;
  dispose: () => void;
} {
  const maxIntervalMs = opts.maxIntervalMs ?? 16;
  let pendingMove = { dx: 0, dy: 0 };
  let pendingScroll = { dx: 0, dy: 0 };
  let rafId: number | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const hasPending = () =>
    pendingMove.dx !== 0 ||
    pendingMove.dy !== 0 ||
    pendingScroll.dx !== 0 ||
    pendingScroll.dy !== 0;

  const cancelSchedule = () => {
    if (rafId != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafId);
    }
    rafId = null;
    if (timerId != null) clearTimeout(timerId);
    timerId = null;
  };

  const flush = () => {
    cancelSchedule();
    if (disposed) return;
    if (opts.isActive && !opts.isActive()) {
      pendingMove = { dx: 0, dy: 0 };
      pendingScroll = { dx: 0, dy: 0 };
      return;
    }

    const move = pendingMove;
    const scroll = pendingScroll;
    pendingMove = { dx: 0, dy: 0 };
    pendingScroll = { dx: 0, dy: 0 };

    if (move.dx !== 0 || move.dy !== 0) {
      opts.send({ type: "pointer-move", dx: move.dx, dy: move.dy });
    }
    if (scroll.dx !== 0 || scroll.dy !== 0) {
      opts.send({
        type: "pointer-scroll",
        dx: scroll.dx,
        dy: scroll.dy,
      });
    }
  };

  const schedule = () => {
    if (disposed || rafId != null || timerId != null) return;
    if (typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        flush();
      });
    }
    timerId = setTimeout(() => {
      timerId = null;
      if (hasPending()) flush();
    }, maxIntervalMs);
  };

  return {
    move(dx, dy) {
      if (disposed) return;
      if (opts.isActive && !opts.isActive()) return;
      pendingMove.dx += dx;
      pendingMove.dy += dy;
      schedule();
    },
    scroll(dx, dy) {
      if (disposed) return;
      if (opts.isActive && !opts.isActive()) return;
      pendingScroll.dx += dx;
      pendingScroll.dy += dy;
      schedule();
    },
    flush,
    clear() {
      cancelSchedule();
      pendingMove = { dx: 0, dy: 0 };
      pendingScroll = { dx: 0, dy: 0 };
    },
    dispose() {
      disposed = true;
      cancelSchedule();
      pendingMove = { dx: 0, dy: 0 };
      pendingScroll = { dx: 0, dy: 0 };
    },
  };
}

/** Tap vs drag threshold in CSS pixels. */
export const TRACKPAD_TAP_SLOP = 10;
export const TRACKPAD_TAP_MAX_MS = 280;
