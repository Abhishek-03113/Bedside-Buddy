import { describe, expect, it } from "vitest";
import { SOURCES, listSources } from "./registry.js";

describe("source registry", () => {
  it("contains Netflix, YouTube, Hotstar, and Prime", () => {
    expect(Object.keys(SOURCES).sort()).toEqual([
      "hotstar",
      "netflix",
      "prime",
      "youtube",
    ]);
    expect(listSources()).toHaveLength(4);
  });

  it("exposes stable metadata and isolated session partitions", () => {
    expect(SOURCES.netflix).toMatchObject({
      id: "netflix",
      displayName: "Netflix",
      homeUrl: "https://www.netflix.com",
      sessionPartition: "persist:netflix",
    });
    expect(SOURCES.youtube).toMatchObject({
      id: "youtube",
      displayName: "YouTube",
      homeUrl: "https://www.youtube.com",
      sessionPartition: "persist:youtube",
    });
    expect(SOURCES.hotstar).toMatchObject({
      id: "hotstar",
      displayName: "Hotstar",
      homeUrl: "https://www.hotstar.com",
      sessionPartition: "persist:hotstar",
    });
    expect(SOURCES.prime).toMatchObject({
      id: "prime",
      displayName: "Prime Video",
      homeUrl: "https://www.primevideo.com",
      sessionPartition: "persist:prime",
    });

    const partitions = listSources().map((s) => s.sessionPartition);
    expect(new Set(partitions).size).toBe(partitions.length);

    for (const source of listSources()) {
      expect(source.icon.src).toBe(`/assets/sources/${source.id}.svg`);
    }
  });

  it("declares honest capabilities per source", () => {
    const netflix = SOURCES.netflix!;
    const youtube = SOURCES.youtube!;
    const hotstar = SOURCES.hotstar!;
    const prime = SOURCES.prime!;

    expect(netflix.capabilities).toEqual({
      supportsSeek: true,
      supportsNextEpisode: true,
      supportsVolume: true,
      supportsScroll: true,
      supportsSearch: true,
      supportsBrowseNavigate: true,
    });
    expect(youtube.capabilities).toEqual({
      supportsSeek: true,
      supportsNextEpisode: false,
      supportsVolume: true,
      supportsScroll: true,
      supportsSearch: true,
      supportsBrowseNavigate: true,
    });
    expect(hotstar.capabilities).toEqual({
      supportsSeek: true,
      supportsNextEpisode: false,
      supportsVolume: true,
      supportsScroll: true,
      supportsSearch: false,
      supportsBrowseNavigate: true,
    });
    expect(prime.capabilities).toEqual({
      supportsSeek: true,
      supportsNextEpisode: false,
      supportsVolume: true,
      supportsScroll: true,
      supportsSearch: true,
      supportsBrowseNavigate: true,
    });
  });
});
