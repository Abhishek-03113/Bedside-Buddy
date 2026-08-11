import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "node:path";
import { SCHEMA_SQL } from "./schema.js";

let db: Database.Database | null = null;

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
