/**
 * SQLite schema — v1 minimal.
 * Session/auth for streaming sites lives in Electron partitions, not here.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS playback_history (
  id INTEGER PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  content_url TEXT NOT NULL,
  title TEXT,
  artwork_url TEXT,
  last_played_at INTEGER NOT NULL,
  position_seconds REAL,
  duration_seconds REAL
);
`;
