import { describe, expect, it, vi } from "vitest";
import type { SourceInput } from "@coosy/shared";
import { NetflixSource } from "./netflix/netflix-source.js";
import { YoutubeSource } from "./youtube/youtube-source.js";
import { HotstarSource } from "./hotstar/hotstar-source.js";

function mockInput(): SourceInput & { sendKey: ReturnType<typeof vi.fn> } {
  return {
    sendKey: vi.fn(async () => ({ ok: true as const })),
    pauseMedia: vi.fn(async () => ({ ok: true as const })),
  };
}

describe("source browse select", () => {
  it("maps select to Enter for Netflix and YouTube", async () => {
    for (const Source of [NetflixSource, YoutubeSource]) {
      const source = new Source();
      const input = mockInput();
      source.bindInput(input);

      const result = await source.handleCommand({ type: "select" });
      expect(result).toEqual({ ok: true });
      expect(input.sendKey).toHaveBeenCalledWith("Enter");
    }
  });

  it("forwards D-pad navigate keys to the active source", async () => {
    const source = new NetflixSource();
    const input = mockInput();
    source.bindInput(input);

    await source.handleCommand({ type: "navigate", direction: "down" });
    expect(input.sendKey).toHaveBeenCalledWith("ArrowDown");
  });

  it("returns unsupported when the source cannot perform the action", async () => {
    const youtube = new YoutubeSource();
    youtube.bindInput(mockInput());
    expect(await youtube.handleCommand({ type: "next-episode" })).toEqual({
      ok: false,
      reason: "unsupported",
    });

    const hotstar = new HotstarSource();
    hotstar.bindInput(mockInput());
    expect(
      await hotstar.handleCommand({ type: "search", query: "cricket" }),
    ).toEqual({ ok: false, reason: "unsupported" });
  });

  it("never claims success without an active input session", async () => {
    const source = new NetflixSource();
    expect(await source.handleCommand({ type: "select" })).toEqual({
      ok: false,
      reason: "no-active-session",
    });
  });
});
