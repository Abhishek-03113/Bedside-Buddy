import { describe, expect, it, vi } from "vitest";
import type { MediaSource, SourcePage } from "@coosy/shared";
import { NetflixSource } from "./netflix/netflix-source.js";
import { YoutubeSource } from "./youtube/youtube-source.js";
import { HotstarSource } from "./hotstar/hotstar-source.js";
import { PrimeSource } from "./prime/prime-source.js";

const cases: Array<[string, new () => MediaSource, string]> = [
  ["netflix", NetflixSource, "https://www.netflix.com/watch/123"],
  ["youtube", YoutubeSource, "https://www.youtube.com/watch?v=123"],
  ["hotstar", HotstarSource, "https://www.hotstar.com/in/movies/example/123"],
  ["prime", PrimeSource, "https://www.primevideo.com/detail/example/123"],
];

describe("source playback URL detection", () => {
  it.each(cases)("recognizes and reopens a %s content URL", async (id, Source, contentUrl) => {
    const navigate = vi.fn();
    const page: SourcePage = { getUrl: () => contentUrl, getTitle: () => "Example", navigate };
    const source = new Source();
    source.bindPage?.(page);

    expect(source.getCurrentPlaybackInfo?.()).toEqual({ sourceId: id, contentUrl, title: "Example" });
    await source.resumePlayback?.(contentUrl);
    expect(navigate).toHaveBeenCalledWith(contentUrl);
  });

  it.each(cases)("does not record an arbitrary %s URL", (_id, Source) => {
    const source = new Source();
    source.bindPage?.({ getUrl: () => "https://example.com/not-a-video", getTitle: () => "Example", navigate: vi.fn() });
    expect(source.getCurrentPlaybackInfo?.()).toBeNull();
  });

  it.each(cases)("does not navigate to a stale %s URL", async (_id, Source) => {
    const navigate = vi.fn();
    const source = new Source();
    source.bindPage?.({ getUrl: () => "", getTitle: () => "", navigate });
    await expect(source.resumePlayback?.("https://example.com/stale")).rejects.toThrow("Invalid");
    expect(navigate).not.toHaveBeenCalled();
  });
});
