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

  it("maps browse navigate / select / scroll and leaves search to URL helper", () => {
    expect(
      translateHotstarCommand({ type: "navigate", direction: "down" }),
    ).toEqual(["ArrowDown"]);
    expect(translateHotstarCommand({ type: "select" })).toEqual(["Enter"]);
    expect(
      translateHotstarCommand({ type: "scroll", direction: "up" }),
    ).toEqual(["PageUp"]);
  });
});

describe("hotstarSearchUrl", () => {
  it("honestly reports unsupported generic search", async () => {
    const { hotstarSearchUrl } = await import("./hotstar-commands.js");
    expect(hotstarSearchUrl("cricket")).toBeNull();
  });
});
