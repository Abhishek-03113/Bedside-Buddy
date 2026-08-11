import { describe, expect, it } from "vitest";
import { translateYoutubeCommand } from "./youtube-commands.js";

describe("translateYoutubeCommand", () => {
  it("maps transport commands to YouTube keys (not Netflix Space)", () => {
    expect(translateYoutubeCommand({ type: "toggle-play-pause" })).toEqual([
      "KeyK",
    ]);
    expect(translateYoutubeCommand({ type: "seek", deltaSeconds: 10 })).toEqual([
      "KeyL",
    ]);
    expect(translateYoutubeCommand({ type: "seek", deltaSeconds: -10 })).toEqual([
      "KeyJ",
    ]);
    expect(
      translateYoutubeCommand({ type: "volume", direction: "down" }),
    ).toEqual(["ArrowDown"]);
  });

  it("does not claim next-episode without modifier support", () => {
    expect(translateYoutubeCommand({ type: "next-episode" })).toBeNull();
  });

  it("maps browse navigate, select, and scroll", () => {
    expect(
      translateYoutubeCommand({ type: "navigate", direction: "up" }),
    ).toEqual(["ArrowUp"]);
    expect(translateYoutubeCommand({ type: "select" })).toEqual(["Enter"]);
    expect(
      translateYoutubeCommand({ type: "scroll", direction: "up" }),
    ).toEqual(["PageUp"]);
  });
});

describe("youtubeSearchUrl", () => {
  it("builds a results URL", async () => {
    const { youtubeSearchUrl } = await import("./youtube-commands.js");
    expect(youtubeSearchUrl("lofi")).toBe(
      "https://www.youtube.com/results?search_query=lofi",
    );
    expect(youtubeSearchUrl("")).toBeNull();
  });
});
