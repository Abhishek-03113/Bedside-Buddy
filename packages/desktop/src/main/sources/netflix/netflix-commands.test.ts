import { describe, expect, it } from "vitest";
import { translateNetflixCommand } from "./netflix-commands.js";

describe("translateNetflixCommand", () => {
  it("maps transport commands to Netflix keys", () => {
    expect(translateNetflixCommand({ type: "toggle-play-pause" })).toEqual([
      "Space",
    ]);
    expect(translateNetflixCommand({ type: "seek", deltaSeconds: 10 })).toEqual([
      "ArrowRight",
    ]);
    expect(translateNetflixCommand({ type: "seek", deltaSeconds: -10 })).toEqual([
      "ArrowLeft",
    ]);
    expect(
      translateNetflixCommand({ type: "volume", direction: "up" }),
    ).toEqual(["ArrowUp"]);
  });
});
