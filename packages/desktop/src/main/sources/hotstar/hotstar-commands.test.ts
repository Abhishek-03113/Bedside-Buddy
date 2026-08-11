import { describe, expect, it } from "vitest";
import { translateHotstarCommand } from "./hotstar-commands.js";

describe("translateHotstarCommand", () => {
  it("maps playback keys explicitly for Hotstar", () => {
    expect(translateHotstarCommand({ type: "toggle-play-pause" })).toEqual([
      "Space",
    ]);
    expect(translateHotstarCommand({ type: "seek", deltaSeconds: 10 })).toEqual([
      "ArrowRight",
    ]);
    expect(translateHotstarCommand({ type: "seek", deltaSeconds: -10 })).toEqual([
      "ArrowLeft",
    ]);
    expect(
      translateHotstarCommand({ type: "volume", direction: "up" }),
    ).toEqual(["ArrowUp"]);
  });

  it("does not invent a next-episode binding", () => {
    expect(translateHotstarCommand({ type: "next-episode" })).toBeNull();
  });
});
