import { describe, expect, it } from "vitest";
import {
  computeSourceViewportBounds,
  isBlankSourceUrl,
  nextHostState,
  shouldReuseSourceView,
} from "./viewport.js";

describe("computeSourceViewportBounds", () => {
  it("fills the content area with no chrome reservation", () => {
    expect(computeSourceViewportBounds({ width: 1920, height: 1080 })).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });

  it("floors and clamps non-integer / negative sizes", () => {
    expect(computeSourceViewportBounds({ width: 800.9, height: -2 })).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 0,
    });
  });
});

describe("isBlankSourceUrl", () => {
  it("treats empty and about:blank as unloadable cold state", () => {
    expect(isBlankSourceUrl(null)).toBe(true);
    expect(isBlankSourceUrl("")).toBe(true);
    expect(isBlankSourceUrl("about:blank")).toBe(true);
    expect(isBlankSourceUrl("https://www.netflix.com")).toBe(false);
  });
});

describe("shouldReuseSourceView", () => {
  it("reuses when the source id is already retained", () => {
    expect(shouldReuseSourceView(["netflix"], "netflix")).toBe(true);
    expect(shouldReuseSourceView(["netflix"], "youtube")).toBe(false);
  });
});

describe("nextHostState", () => {
  it("pauses previous source when switching", () => {
    expect(
      nextHostState(
        { surface: "source", activeSourceId: "netflix" },
        { type: "show-source", sourceId: "youtube" },
      ),
    ).toEqual({
      surface: "source",
      activeSourceId: "youtube",
      pauseSourceId: "netflix",
    });
  });

  it("does not pause when reopening the same source", () => {
    expect(
      nextHostState(
        { surface: "source", activeSourceId: "netflix" },
        { type: "show-source", sourceId: "netflix" },
      ),
    ).toEqual({
      surface: "source",
      activeSourceId: "netflix",
      pauseSourceId: null,
    });
  });

  it("returns to launcher and pauses active source", () => {
    expect(
      nextHostState(
        { surface: "source", activeSourceId: "netflix" },
        { type: "show-launcher" },
      ),
    ).toEqual({
      surface: "launcher",
      activeSourceId: null,
      pauseSourceId: "netflix",
    });
  });
});
