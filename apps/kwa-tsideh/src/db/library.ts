import type { SearchResult } from '../core/types';
import { getDb } from './schema';

export interface HistoryEntry {
  readonly id: number;
  readonly query: string;
  readonly ts: number;
  readonly result_count: number;
}

export async function recordSearch(query: string, resultCount: number): Promise<void> {
  const q = query.trim();
  if (!q) return;
  try {
    const db = getDb();
    await db.runAsync('DELETE FROM history WHERE query = ?;', q);
    await db.runAsync(
      'INSERT INTO history (query, ts, result_count) VALUES (?, ?, ?);',
      q,
      Date.now(),
      resultCount,
    );
  } catch {
    /* history is best-effort */
  }
}

export async function recentSearches(limit = 30): Promise<readonly HistoryEntry[]> {
  try {
    return await getDb().getAllAsync<HistoryEntry>(
      'SELECT id, query, ts, result_count FROM history ORDER BY ts DESC LIMIT ?;',
      limit,
    );
  } catch {
    return [];
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await getDb().runAsync('DELETE FROM history;');
  } catch {
    /* no-op */
  }
}

export async function listFavorites(): Promise<readonly SearchResult[]> {
  try {
    const rows = await getDb().getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM favorites ORDER BY saved_at DESC;',
    );
    return rows.map((r) => JSON.parse(r.payload_json) as SearchResult);
  } catch {
    return [];
  }
}

export async function isFavorite(resultId: string): Promise<boolean> {
  try {
    const row = await getDb().getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM favorites WHERE result_id = ?;',
      resultId,
    );
    return (row?.n ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Favorites store the whole result, so the library opens with no network. */
export async function toggleFavorite(result: SearchResult): Promise<boolean> {
  try {
    const db = getDb();
    if (await isFavorite(result.id)) {
      await db.runAsync('DELETE FROM favorites WHERE result_id = ?;', result.id);
      return false;
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO favorites (result_id, source_id, title, snippet, url, payload_json, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
      result.id,
      result.sourceId,
      result.title,
      result.snippet,
      result.url,
      JSON.stringify(result),
      Date.now(),
    );
    return true;
  } catch {
    return false;
  }
}

export async function findResultById(resultId: string): Promise<SearchResult | null> {
  try {
    const row = await getDb().getFirstAsync<{ payload_json: string }>(
      'SELECT payload_json FROM favorites WHERE result_id = ?;',
      resultId,
    );
    if (row) return JSON.parse(row.payload_json) as SearchResult;
    const cached = await getDb().getAllAsync<{ payload_json: string }>('SELECT payload_json FROM cache;');
    for (const c of cached) {
      const list = JSON.parse(c.payload_json) as SearchResult[];
      const hit = list.find((r) => r.id === resultId);
      if (hit) return hit;
    }
    return null;
  } catch {
    return null;
  }
}
