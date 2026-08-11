import { describe, expect, it } from "vitest";
import { toContinueItems } from "./continue-items.js";

describe("playback history to ContinueCard mapping", () => {
  it("preserves source identity and excludes unregistered sources", () => {
    expect(toContinueItems(
      [
        { id: 1, sourceId: "netflix", contentUrl: "https://www.netflix.com/watch/1", title: "Dark", lastPlayedAt: 1 },
        { id: 2, sourceId: "missing", contentUrl: "https://example.com", lastPlayedAt: 2 },
      ],
      [{ id: "netflix", displayName: "Netflix", icon: { src: "/assets/sources/netflix.svg" }, capabilities: { supportsSeek: true, supportsNextEpisode: true, supportsVolume: true } }],
    )).toEqual([
      { id: 1, sourceId: "netflix", contentUrl: "https://www.netflix.com/watch/1", title: "Dark", lastPlayedAt: 1, sourceName: "Netflix", sourceIcon: "/assets/sources/netflix.svg" },
    ]);
  });
});
