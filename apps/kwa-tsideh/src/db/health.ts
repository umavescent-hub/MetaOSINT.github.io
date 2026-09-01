import type { SourceId } from '../core/types';
import { getDb } from './schema';

/**
 * A source that has failed repeatedly stops being asked for a while. This keeps
 * a dead API from eating its slice of the search budget on every keystroke --
 * the user feels a faster search, not a broken one.
 */
export const FAILURES_BEFORE_REST = 3;
export const REST_MS = 5 * 60 * 1000;

export interface Health {
  readonly source_id: string;
  readonly last_ok_at: number | null;
  readonly last_error: string | null;
  readonly consecutive_failures: number;
  readonly resting_until: number | null;
}

export async function loadHealth(): Promise<ReadonlyMap<string, Health>> {
  try {
    const rows = await getDb().getAllAsync<Health>(
      'SELECT source_id, last_ok_at, last_error, consecutive_failures, resting_until FROM source_health;',
    );
    return new Map(rows.map((r) => [r.source_id, r]));
  } catch {
    return new Map();
  }
}

export function isResting(health: ReadonlyMap<string, Health>, id: SourceId | string): boolean {
  const h = health.get(String(id));
  return h?.resting_until != null && h.resting_until > Date.now();
}

export async function recordSuccess(id: SourceId): Promise<void> {
  try {
    await getDb().runAsync(
      `INSERT INTO source_health (source_id, last_ok_at, last_error, consecutive_failures, resting_until)
       VALUES (?, ?, NULL, 0, NULL)
       ON CONFLICT(source_id) DO UPDATE SET
         last_ok_at = excluded.last_ok_at,
         last_error = NULL,
         consecutive_failures = 0,
         resting_until = NULL;`,
      String(id),
      Date.now(),
    );
  } catch {
    /* health is telemetry, never a failure path */
  }
}

export async function recordFailure(id: SourceId, error: string): Promise<void> {
  try {
    const db = getDb();
    const row = await db.getFirstAsync<{ consecutive_failures: number }>(
      'SELECT consecutive_failures FROM source_health WHERE source_id = ?;',
      String(id),
    );
    const failures = (row?.consecutive_failures ?? 0) + 1;
    const restingUntil = failures >= FAILURES_BEFORE_REST ? Date.now() + REST_MS : null;
    await db.runAsync(
      `INSERT INTO source_health (source_id, last_ok_at, last_error, consecutive_failures, resting_until)
       VALUES (?, NULL, ?, ?, ?)
       ON CONFLICT(source_id) DO UPDATE SET
         last_error = excluded.last_error,
         consecutive_failures = excluded.consecutive_failures,
         resting_until = excluded.resting_until;`,
      String(id),
      error.slice(0, 200),
      failures,
      restingUntil,
    );
  } catch {
    /* no-op */
  }
}

/** User-initiated: pull-to-refresh forgives every resting source immediately. */
export async function wakeAll(): Promise<void> {
  try {
    await getDb().runAsync('UPDATE source_health SET resting_until = NULL, consecutive_failures = 0;');
  } catch {
    /* no-op */
  }
}
