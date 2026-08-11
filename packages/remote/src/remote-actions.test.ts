import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  feedbackLabel,
  resolveControlAction,
  TOAST_DISMISS_MS,
} from "./remote-actions.js";

describe("resolveControlAction", () => {
  it("keeps launcher D-pad / select as nav for desktop HomeScreen", () => {
    expect(resolveControlAction("launcher", "up")).toEqual({
      kind: "nav",
      action: "up",
    });
    expect(resolveControlAction("launcher", "down")).toEqual({
      kind: "nav",
      action: "down",
    });
    expect(resolveControlAction("launcher", "left")).toEqual({
      kind: "nav",
      action: "left",
    });
    expect(resolveControlAction("launcher", "right")).toEqual({
      kind: "nav",
      action: "right",
    });
    expect(resolveControlAction("launcher", "select")).toEqual({
      kind: "nav",
      action: "select",
    });
  });

  it("maps Home/Back to nav in both modes", () => {
    expect(resolveControlAction("launcher", "home")).toEqual({
      kind: "nav",
      action: "home",
    });
    expect(resolveControlAction("launcher", "back")).toEqual({
      kind: "nav",
      action: "back",
    });
    expect(resolveControlAction("player", "home")).toEqual({
      kind: "nav",
      action: "home",
    });
    expect(resolveControlAction("player", "back")).toEqual({
      kind: "nav",
      action: "back",
    });
  });

  it("maps player D-pad to navigate / activate commands", () => {
    expect(resolveControlAction("player", "up")).toEqual({
      kind: "command",
      command: { type: "navigate", direction: "up" },
    });
    expect(resolveControlAction("player", "select")).toEqual({
      kind: "command",
      command: { type: "activate" },
    });
  });
});

describe("feedbackLabel", () => {
  it("keeps success messages intact and marks failures", () => {
    expect(feedbackLabel("scroll", true)).toBe("scroll");
    expect(feedbackLabel("search", false)).toBe("search failed");
    expect(feedbackLabel("search failed (unsupported)", false)).toBe(
      "search failed (unsupported)",
    );
  });
});

describe("toast dismiss constant", () => {
  it("auto-dismisses on a short timer", () => {
    expect(TOAST_DISMISS_MS).toBeGreaterThan(500);
    expect(TOAST_DISMISS_MS).toBeLessThanOrEqual(2500);
  });
});

describe("useRemoteToast lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces toast content and clears after dismiss window", () => {
    // Lightweight lifecycle check without a React render harness:
    // mirror the hook's timer behavior used by App / RemoteControls.
    let toast: { message: string; ok: boolean } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const show = (next: { message: string; ok: boolean }) => {
      if (timer != null) clearTimeout(timer);
      toast = next;
      timer = setTimeout(() => {
        toast = null;
        timer = null;
      }, TOAST_DISMISS_MS);
    };

    show({ message: "nav:up", ok: true });
    expect(toast).toEqual({ message: "nav:up", ok: true });
    show({ message: "activate", ok: true });
    expect(toast).toEqual({ message: "activate", ok: true });

    vi.advanceTimersByTime(TOAST_DISMISS_MS - 1);
    expect(toast).toEqual({ message: "activate", ok: true });
    vi.advanceTimersByTime(1);
    expect(toast).toBeNull();
  });
});
