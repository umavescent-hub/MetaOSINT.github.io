import * as SQLite from 'expo-sqlite';

const DB_NAME = 'kwatsideh.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Versioned, idempotent migrations. Bump SCHEMA_VERSION and append a step --
 * never edit a shipped step.
 */
const SCHEMA_VERSION = 1;

const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    ts INTEGER NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_history_ts ON history(ts DESC);

  CREATE TABLE IF NOT EXISTS favorites (
    result_id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    snippet TEXT NOT NULL,
    url TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    saved_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_favorites_saved ON favorites(saved_at DESC);

  CREATE TABLE IF NOT EXISTS cache (
    query_hash TEXT NOT NULL,
    source_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    ttl_ms INTEGER NOT NULL,
    PRIMARY KEY (query_hash, source_id)
  );

  CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS source_health (
    source_id TEXT PRIMARY KEY,
    last_ok_at INTEGER,
    last_error TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    resting_until INTEGER
  );
  `,
];

export function getDb(): SQLite.SQLiteDatabase {
  db ??= SQLite.openDatabaseSync(DB_NAME);
  return db;
}

/**
 * Runs at boot. A migration failure must degrade to a working, memory-only app
 * rather than a white screen -- search does not depend on the database.
 */
export async function initDb(): Promise<boolean> {
  try {
    const handle = getDb();
    await handle.execAsync('PRAGMA journal_mode = WAL;');
    const row = await handle.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    const current = row?.user_version ?? 0;
    for (let v = current; v < SCHEMA_VERSION; v++) {
      const step = MIGRATIONS[v];
      if (step) await handle.execAsync(step);
    }
    if (current < SCHEMA_VERSION) {
      await handle.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    }
    return true;
  } catch (err) {
    if (__DEV__) console.warn('[db] init failed; running without persistence', err);
    return false;
  }
}

export async function readPref<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await getDb().getFirstAsync<{ value_json: string }>(
      'SELECT value_json FROM prefs WHERE key = ?;',
      key,
    );
    return row ? (JSON.parse(row.value_json) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writePref<T>(key: string, value: T): Promise<void> {
  try {
    await getDb().runAsync(
      'INSERT OR REPLACE INTO prefs (key, value_json) VALUES (?, ?);',
      key,
      JSON.stringify(value),
    );
  } catch {
    /* preferences are best-effort */
  }
}
