import type { SearchResult, SourceId } from '../core/types';
import { getDb } from './schema';

/** Results stay warm for 15 minutes -- long enough to feel instant, short
 *  enough that a second look is still current. */
export const DEFAULT_TTL_MS = 15 * 60 * 1000;

/** Stable, cheap hash. Queries are short; collisions are not a safety concern. */
export function queryHash(query: string): string {
  const norm = query.trim().toLowerCase().replace(/\s+/g, ' ');
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) | 0;
  return `${norm.length}_${(h >>> 0).toString(36)}`;
}

export async function readCache(query: string): Promise<readonly SearchResult[]> {
  try {
    const rows = await getDb().getAllAsync<{ payload_json: string; fetched_at: number; ttl_ms: number }>(
      'SELECT payload_json, fetched_at, ttl_ms FROM cache WHERE query_hash = ?;',
      queryHash(query),
    );
    const now = Date.now();
    const out: SearchResult[] = [];
    for (const row of rows) {
      if (now - row.fetched_at > row.ttl_ms) continue;
      const parsed = JSON.parse(row.payload_json) as SearchResult[];
      out.push(...parsed);
    }
    return out;
  } catch {
    return [];
  }
}

export async function writeCache(
  query: string,
  source: SourceId,
  results: readonly SearchResult[],
): Promise<void> {
  try {
    await getDb().runAsync(
      'INSERT OR REPLACE INTO cache (query_hash, source_id, payload_json, fetched_at, ttl_ms) VALUES (?, ?, ?, ?, ?);',
      queryHash(query),
      source,
      JSON.stringify(results),
      Date.now(),
      DEFAULT_TTL_MS,
    );
  } catch {
    // Cache is an optimization. Losing a write is never an error the user sees.
  }
}

export async function clearCache(): Promise<void> {
  try {
    await getDb().runAsync('DELETE FROM cache;');
  } catch {
    /* no-op */
  }
}
