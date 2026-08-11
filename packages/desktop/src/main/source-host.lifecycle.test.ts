import { describe, expect, it } from "vitest";
import { nextHostState, shouldReuseSourceView } from "./viewport.js";

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
});
