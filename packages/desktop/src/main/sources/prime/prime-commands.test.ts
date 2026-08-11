import { describe, expect, it } from "vitest";
import { translatePrimeCommand } from "./prime-commands.js";

describe("translatePrimeCommand", () => {
  it("maps playback keys explicitly for Prime Video", () => {
    expect(translatePrimeCommand({ type: "play" })).toEqual(["Space"]);
    expect(translatePrimeCommand({ type: "pause" })).toEqual(["Space"]);
    expect(translatePrimeCommand({ type: "seek", deltaSeconds: 10 })).toEqual([
      "ArrowRight",
    ]);
    expect(translatePrimeCommand({ type: "seek", deltaSeconds: -5 })).toEqual([
      "ArrowLeft",
    ]);
    expect(
      translatePrimeCommand({ type: "volume", direction: "down" }),
    ).toEqual(["ArrowDown"]);
  });

  it("does not invent a next-episode binding", () => {
    expect(translatePrimeCommand({ type: "next-episode" })).toBeNull();
  });
});
