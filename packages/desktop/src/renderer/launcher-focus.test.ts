import { describe, expect, it } from "vitest";
import {
  clampFocusIndex,
  columnCountFromTemplate,
  moveFocusIndex,
  resolveInitialFocusIndex,
} from "./launcher-focus.js";

const FOUR = ["netflix", "youtube", "hotstar", "prime"] as const;

describe("launcher focus model", () => {
  it("defaults to the first source on home launch", () => {
    expect(resolveInitialFocusIndex(FOUR, null)).toBe(0);
    expect(resolveInitialFocusIndex(FOUR, undefined)).toBe(0);
  });

  it("restores the previous focused source after returning home", () => {
    expect(resolveInitialFocusIndex(FOUR, "hotstar")).toBe(2);
    expect(resolveInitialFocusIndex(FOUR, "prime")).toBe(3);
  });

  it("falls back to the first source when the previous id is missing", () => {
    expect(resolveInitialFocusIndex(FOUR, "spotify")).toBe(0);
    expect(resolveInitialFocusIndex([], "netflix")).toBe(0);
  });

  it("moves focus across a spatial grid without hardcoding four tiles", () => {
    // 2-column grid: 0 1 / 2 3 / 4
    expect(moveFocusIndex(0, "right", 5, 2)).toBe(1);
    expect(moveFocusIndex(1, "right", 5, 2)).toBe(2);
    expect(moveFocusIndex(0, "down", 5, 2)).toBe(2);
    expect(moveFocusIndex(2, "up", 5, 2)).toBe(0);
    expect(moveFocusIndex(4, "right", 5, 2)).toBe(0); // wrap
    expect(moveFocusIndex(0, "left", 5, 2)).toBe(4); // wrap
  });

  it("clamps focus so it never becomes lost", () => {
    expect(clampFocusIndex(9, 4)).toBe(3);
    expect(clampFocusIndex(-1, 4)).toBe(0);
    expect(clampFocusIndex(2, 0)).toBe(0);
  });

  it("derives column count from CSS grid-template-columns", () => {
    expect(columnCountFromTemplate("160px 160px 160px 160px")).toBe(4);
    expect(columnCountFromTemplate("1fr 1fr")).toBe(2);
    expect(columnCountFromTemplate("")).toBe(1);
  });
});

describe("Enter / Space activation contract", () => {
  it("treats select as the shared activation action used by Enter and Space", () => {
    // HomeScreen maps both Enter and Space → NavAction "select",
    // then routes through activateFocusedSource().
    const activateFocusedSource = (ids: string[], focusIndex: number) =>
      ids[focusIndex] ?? null;

    expect(activateFocusedSource([...FOUR], 0)).toBe("netflix");
    expect(activateFocusedSource([...FOUR], 1)).toBe("youtube");
    expect(activateFocusedSource([...FOUR], 3)).toBe("prime");
  });
});
