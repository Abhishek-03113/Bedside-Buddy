import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "./schema.js";

describe("playback_history schema", () => {
  it("keeps one mutable row per source and returns the most recent rows first", () => {
    const db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    const upsert = db.prepare(
      `INSERT INTO playback_history (source_id, content_url, last_played_at)
       VALUES (?, ?, ?)
       ON CONFLICT(source_id) DO UPDATE SET content_url = excluded.content_url, last_played_at = excluded.last_played_at`,
    );
    upsert.run("netflix", "https://www.netflix.com/watch/one", 1);
    upsert.run("netflix", "https://www.netflix.com/watch/two", 2);
    upsert.run("youtube", "https://www.youtube.com/watch?v=one", 3);
    upsert.run("prime", "https://www.primevideo.com/detail/one", 4);

    expect(db.prepare("SELECT source_id, content_url, last_played_at FROM playback_history ORDER BY last_played_at DESC LIMIT 2").all())
      .toEqual([
        { source_id: "prime", content_url: "https://www.primevideo.com/detail/one", last_played_at: 4 },
        { source_id: "youtube", content_url: "https://www.youtube.com/watch?v=one", last_played_at: 3 },
      ]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM playback_history WHERE source_id = 'netflix'").get())
      .toEqual({ count: 1 });
    db.close();
  });
});
