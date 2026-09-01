import { makeFetchers } from './http';
import { waitForSlot } from './rateLimit';
import { allSources } from './registry';
import { rank } from './rank';
import type { FanoutReport, SearchResult, SourceAdapter, SourceId, SourceOutcome } from './types';

/** Hard wall-clock budget for a whole search. Nothing renders later than this. */
export const FANOUT_BUDGET_MS = 2500;
const PER_SOURCE_LIMIT = 12;

export interface FanoutOptions {
  readonly enabled: Readonly<Record<string, boolean>>;
  readonly weights: Readonly<Record<string, number>>;
  readonly proxyUrl: string | null;
  readonly signal?: AbortSignal;
  /** Fires as each source lands, so the feed fills in progressively. */
  readonly onPartial?: (outcome: SourceOutcome) => void;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'Timed out';
    return err.message;
  }
  return 'Unknown error';
}

async function runOne(
  adapter: SourceAdapter,
  query: string,
  outer: AbortSignal,
): Promise<SourceOutcome> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), adapter.timeoutMs);
  const onOuterAbort = (): void => ctrl.abort();
  outer.addEventListener('abort', onOuterAbort, { once: true });
  try {
    await waitForSlot(adapter.id, adapter.minIntervalMs, ctrl.signal);
    const { fetchJson, fetchText } = makeFetchers(ctrl.signal);
    const results = await adapter.search(query, {
      signal: ctrl.signal,
      limit: PER_SOURCE_LIMIT,
      fetchJson,
      fetchText,
    });
    return { status: 'ok', sourceId: adapter.id, results, ms: Date.now() - started, fromCache: false };
  } catch (err) {
    const ms = Date.now() - started;
    if (err instanceof Error && err.name === 'AbortError') {
      return { status: 'timeout', sourceId: adapter.id, ms };
    }
    return { status: 'error', sourceId: adapter.id, error: errorMessage(err), ms };
  } finally {
    clearTimeout(timer);
    outer.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * Fan out to every enabled source in parallel. Each source is isolated: its own
 * abort signal, its own try/catch, its own outcome. One dead source can never
 * blank the feed, stall the budget, or throw into the UI.
 */
export async function fanout(query: string, opts: FanoutOptions): Promise<FanoutReport> {
  const started = Date.now();
  const adapters = allSources();
  const budget = new AbortController();
  const budgetTimer = setTimeout(() => budget.abort(), FANOUT_BUDGET_MS);
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => budget.abort(), { once: true });
  }

  const jobs = adapters.map(async (adapter): Promise<SourceOutcome> => {
    if (opts.enabled[adapter.id] === false) {
      return { status: 'skipped', sourceId: adapter.id, reason: 'disabled' };
    }
    if (adapter.requiresProxy && !opts.proxyUrl) {
      return { status: 'skipped', sourceId: adapter.id, reason: 'no-proxy' };
    }
    const outcome = await runOne(adapter, query, budget.signal);
    opts.onPartial?.(outcome);
    return outcome;
  });

  const settled = await Promise.allSettled(jobs);
  clearTimeout(budgetTimer);

  const outcomes: SourceOutcome[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    const id = (adapters[i]?.id ?? 'unknown') as SourceId;
    return { status: 'error', sourceId: id, error: errorMessage(s.reason), ms: Date.now() - started };
  });

  const merged: SearchResult[] = [];
  for (const o of outcomes) if (o.status === 'ok') merged.push(...o.results);

  return {
    query,
    results: rank(merged, query, adapters, opts.weights),
    outcomes,
    ms: Date.now() - started,
  };
}
