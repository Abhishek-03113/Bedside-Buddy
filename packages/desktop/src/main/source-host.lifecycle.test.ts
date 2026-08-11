import { describe, expect, it, vi } from "vitest";
import {
  nextHostState,
  pauseSourcePlayback,
  shouldReuseSourceView,
} from "./viewport.js";

/**
 * Lifecycle contracts for SourceHost — pure helpers mirror host behavior.
 * Full Electron WebContentsView counts are validated by code inspection +
 * getRetainedSourceIds() at runtime; these tests lock the state machine.
 */
describe("SourceHost lifecycle contracts", () => {
  it("reuses a retained view id on repeated activation", () => {
    const retained = ["netflix", "youtube", "hotstar", "prime"];
    for (const id of retained) {
      expect(shouldReuseSourceView(retained, id)).toBe(true);
    }
    // Switching does not imply creating a fifth view for an existing id.
    expect(shouldReuseSourceView(retained, "netflix")).toBe(true);
  });

  it("does not treat same-source reopen as a switch that pauses itself", () => {
    const reopen = nextHostState(
      { surface: "source", activeSourceId: "netflix" },
      { type: "show-source", sourceId: "netflix" },
    );
    expect(reopen.pauseSourceId).toBeNull();
    expect(reopen.activeSourceId).toBe("netflix");
  });

  it("pauses previous source exactly once when switching", () => {
    const switched = nextHostState(
      { surface: "source", activeSourceId: "netflix" },
      { type: "show-source", sourceId: "youtube" },
    );
    expect(switched.pauseSourceId).toBe("netflix");
    expect(switched.activeSourceId).toBe("youtube");
  });

  it("pauses the active source before returning to the launcher", () => {
    const left = nextHostState(
      { surface: "source", activeSourceId: "netflix" },
      { type: "show-launcher" },
    );
    expect(left.pauseSourceId).toBe("netflix");
    expect(left.activeSourceId).toBeNull();
  });

  it("retains a paused source view for a later reopen", () => {
    const retained = ["netflix"];
    const left = nextHostState(
      { surface: "source", activeSourceId: "netflix" },
      { type: "show-launcher" },
    );
    expect(left.pauseSourceId).toBe("netflix");
    expect(shouldReuseSourceView(retained, "netflix")).toBe(true);
  });

  it("runs the active source pause once and tolerates unavailable sources", async () => {
    const pausePlayback = vi.fn().mockResolvedValue({ ok: true });

    await pauseSourcePlayback({ pausePlayback });
    await pauseSourcePlayback(undefined);

    expect(pausePlayback).toHaveBeenCalledTimes(1);
  });
});
