import { describe, expect, it, vi } from "vitest";
import type { MediaSource, SourceInput } from "@coosy/shared";
import { NetflixSource } from "./netflix/netflix-source.js";
import { YoutubeSource } from "./youtube/youtube-source.js";
import { HotstarSource } from "./hotstar/hotstar-source.js";
import { PrimeSource } from "./prime/prime-source.js";

const sources: Array<new () => MediaSource> = [
  NetflixSource,
  YoutubeSource,
  HotstarSource,
  PrimeSource,
];

describe("source playback pause", () => {
  it.each(sources)("pauses %p through its retained source input", async (Source) => {
    const source = new Source();
    const pauseMedia = vi.fn().mockResolvedValue({ ok: true } as const);
    const input: SourceInput = {
      sendKey: vi.fn(),
      pauseMedia,
    };
    source.bindInput?.(input);

    await expect(source.pausePlayback()).resolves.toEqual({ ok: true });
    await expect(source.pausePlayback()).resolves.toEqual({ ok: true });
    expect(pauseMedia).toHaveBeenCalledTimes(2);
  });

  it.each(sources)("safely ignores a missing or destroyed source view for %p", async (Source) => {
    const source = new Source();

    await expect(source.pausePlayback()).resolves.toEqual({
      ok: false,
      reason: "no-active-session",
    });
  });
});
