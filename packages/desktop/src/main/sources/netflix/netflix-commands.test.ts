import { describe, expect, it } from "vitest";
import {
  netflixSearchUrl,
  translateNetflixCommand,
} from "./netflix-commands.js";

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
    expect(translateNetflixCommand({ type: "next-episode" })).toEqual(["KeyN"]);
  });

  it("maps browse navigate, activate, and scroll", () => {
    expect(
      translateNetflixCommand({ type: "navigate", direction: "left" }),
    ).toEqual(["ArrowLeft"]);
    expect(translateNetflixCommand({ type: "activate" })).toEqual(["Enter"]);
    expect(
      translateNetflixCommand({ type: "scroll", direction: "down" }),
    ).toEqual(["PageDown"]);
    expect(
      translateNetflixCommand({ type: "search", query: "dark" }),
    ).toBeNull();
  });
});

describe("netflixSearchUrl", () => {
  it("builds a search URL and rejects blank queries", () => {
    expect(netflixSearchUrl("  dark  ")).toBe(
      "https://www.netflix.com/search?q=dark",
    );
    expect(netflixSearchUrl("   ")).toBeNull();
  });
});
