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
`;
