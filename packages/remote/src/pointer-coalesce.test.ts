import { describe, expect, it, vi } from "vitest";
import {
  createPointerCoalescer,
  TRACKPAD_TAP_MAX_MS,
  TRACKPAD_TAP_SLOP,
} from "./pointer-coalesce.js";

describe("pointer-coalescer", () => {
  it("preserves total move deltas across a single flush", () => {
    const sends: Array<{ type: string; dx: number; dy: number }> = [];
    const coalescer = createPointerCoalescer({
      send: (cmd) => sends.push(cmd as { type: string; dx: number; dy: number }),
      isActive: () => true,
    });

    coalescer.move(4, 2);
    coalescer.move(3, 1);
    coalescer.move(1, 5);
    coalescer.flush();

    expect(sends).toEqual([{ type: "pointer-move", dx: 8, dy: 8 }]);
  });

  it("keeps move and scroll pending streams isolated", () => {
    const sends: Array<{ type: string; dx: number; dy: number }> = [];
    const coalescer = createPointerCoalescer({
      send: (cmd) => sends.push(cmd as { type: string; dx: number; dy: number }),
      isActive: () => true,
    });

    coalescer.move(4, 2);
    coalescer.scroll(10, -5);
    coalescer.flush();

    expect(sends).toEqual([
      { type: "pointer-move", dx: 4, dy: 2 },
      { type: "pointer-scroll", dx: 10, dy: -5 },
    ]);
  });

  it("flushes immediately and clears pending state on dispose and clear", () => {
    const send = vi.fn();
    const coalescer = createPointerCoalescer({ send, isActive: () => true });

    coalescer.move(5, 0);
    coalescer.flush();
    expect(send).toHaveBeenCalledTimes(1);

    coalescer.move(10, 2);
    coalescer.clear();
    coalescer.flush();
    expect(send).toHaveBeenCalledTimes(1);

    coalescer.move(2, 2);
    coalescer.dispose();
    coalescer.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("exposes tap thresholds for gesture logic", () => {
    expect(TRACKPAD_TAP_SLOP).toBe(10);
    expect(TRACKPAD_TAP_MAX_MS).toBe(280);
  });
});
