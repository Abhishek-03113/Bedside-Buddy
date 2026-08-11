import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "node:path";
import { SCHEMA_SQL } from "./schema.js";
import type { PlaybackHistoryItem } from "@coosy/shared";

let db: Database.Database | null = null;

type PlaybackHistoryRow = {
  id: number;
  source_id: string;
  content_url: string;
  title: string | null;
  artwork_url: string | null;
  last_played_at: number;
  position_seconds: number | null;
  duration_seconds: number | null;
};

function toPlaybackHistoryItem(row: PlaybackHistoryRow): PlaybackHistoryItem {
  return {
    id: row.id,
    sourceId: row.source_id,
    contentUrl: row.content_url,
    ...(row.title ? { title: row.title } : {}),
    ...(row.artwork_url ? { artworkUrl: row.artwork_url } : {}),
    lastPlayedAt: row.last_played_at,
    ...(row.position_seconds != null ? { positionSeconds: row.position_seconds } : {}),
    ...(row.duration_seconds != null ? { durationSeconds: row.duration_seconds } : {}),
  };
}

export function initDb(): Database.Database {
  if (db) return db;

  const path = join(app.getPath("userData"), "coosy.sqlite");
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return db;
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized — call initDb() first");
  }
  return db;
}

export function getAppState(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setAppState(key: string, value: string): void {
  const current = getAppState(key);
  if (current === value) return;
  getDb()
    .prepare(
      `INSERT INTO app_state (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

export function touchSource(id: string): void {
  getDb()
    .prepare(
      `INSERT INTO sources (id, last_used_at) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET last_used_at = excluded.last_used_at`,
    )
    .run(id, Date.now());
}

/** One current item per source: later playback replaces the earlier source row. */
export function upsertPlayback(item: Omit<PlaybackHistoryItem, "id" | "lastPlayedAt">): void {
  getDb()
    .prepare(
      `INSERT INTO playback_history
        (source_id, content_url, title, artwork_url, last_played_at, position_seconds, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_id) DO UPDATE SET
         content_url = excluded.content_url,
         title = excluded.title,
         artwork_url = excluded.artwork_url,
         last_played_at = excluded.last_played_at,
         position_seconds = excluded.position_seconds,
         duration_seconds = excluded.duration_seconds`,
    )
    .run(
      item.sourceId,
      item.contentUrl,
      item.title ?? null,
      item.artworkUrl ?? null,
      Date.now(),
      item.positionSeconds ?? null,
      item.durationSeconds ?? null,
    );
}

export function getRecentPlayback(limit: number): PlaybackHistoryItem[] {
  return (getDb()
    .prepare("SELECT * FROM playback_history ORDER BY last_played_at DESC LIMIT ?")
    .all(limit) as PlaybackHistoryRow[]).map(toPlaybackHistoryItem);
}

export function removePlayback(id: number): void {
  getDb().prepare("DELETE FROM playback_history WHERE id = ?").run(id);
}
