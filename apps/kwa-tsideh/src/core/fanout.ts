import { HttpError, makeFetchers, NetworkError } from './http';
import { waitForSlot } from './rateLimit';
import { allSources } from './registry';
import { rank } from './rank';
import { isResting, loadHealth, recordFailure, recordSuccess, type Health } from '../db/health';
import type {
  FailureKind,
  FanoutReport,
  SearchResult,
  SourceAdapter,
  SourceId,
  SourceOutcome,
} from './types';

/** Hard wall-clock budget for a whole search. Nothing renders later than this. */
export const FANOUT_BUDGET_MS = 2500;
const PER_SOURCE_LIMIT = 12;

export interface FanoutOptions {
  readonly enabled: Readonly<Record<string, boolean>>;
  readonly weights: Readonly<Record<string, number>>;
  readonly proxyUrl: string | null;
  readonly signal?: AbortSignal;
  /** Ignore the rest period -- pull-to-refresh forgives every source. */
  readonly force?: boolean;
  /** Fires as each source lands, so the feed can fill in progressively. */
  readonly onPartial?: (outcome: SourceOutcome) => void;
}

function classify(err: unknown): { message: string; kind: FailureKind } {
  if (err instanceof NetworkError) return { message: 'Unreachable', kind: 'network' };
  if (err instanceof HttpError) return { message: `HTTP ${err.status}`, kind: 'http' };
  if (err instanceof SyntaxError) return { message: 'Bad response', kind: 'parse' };
  if (err instanceof Error) return { message: err.message, kind: 'unknown' };
  return { message: 'Unknown error', kind: 'unknown' };
}

async function runOne(
  adapter: SourceAdapter,
  query: string,
  outer: AbortSignal,
  proxyUrl: string | null,
): Promise<SourceOutcome> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), adapter.timeoutMs);
  const onOuterAbort = (): void => ctrl.abort();
  outer.addEventListener('abort', onOuterAbort, { once: true });
  try {
    await waitForSlot(adapter.id, adapter.minIntervalMs, ctrl.signal);
    const proxy =
      adapter.requiresProxy && proxyUrl ? { baseUrl: proxyUrl, sourceId: String(adapter.id) } : null;
    const { fetchJson, fetchText } = makeFetchers(ctrl.signal, proxy);
    const results = await adapter.search(query, {
      signal: ctrl.signal,
      limit: PER_SOURCE_LIMIT,
      fetchJson,
      fetchText,
    });
    void recordSuccess(adapter.id);
    return { status: 'ok', sourceId: adapter.id, results, ms: Date.now() - started, fromCache: false };
  } catch (err) {
    const ms = Date.now() - started;
    if (err instanceof Error && err.name === 'AbortError') {
      void recordFailure(adapter.id, 'Timed out');
      return { status: 'timeout', sourceId: adapter.id, ms };
    }
    const { message, kind } = classify(err);
    void recordFailure(adapter.id, message);
    return { status: 'error', sourceId: adapter.id, error: message, kind, ms };
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
  const health: ReadonlyMap<string, Health> = opts.force ? new Map() : await loadHealth();

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
    if (isResting(health, adapter.id)) {
      return { status: 'skipped', sourceId: adapter.id, reason: 'resting' };
    }
    const outcome = await runOne(adapter, query, budget.signal, opts.proxyUrl);
    opts.onPartial?.(outcome);
    return outcome;
  });

  const settled = await Promise.allSettled(jobs);
  clearTimeout(budgetTimer);

  const outcomes: SourceOutcome[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    const id = (adapters[i]?.id ?? 'unknown') as SourceId;
    const { message, kind } = classify(s.reason);
    return { status: 'error', sourceId: id, error: message, kind, ms: Date.now() - started };
  });

  const attempted = outcomes.filter((o) => o.status !== 'skipped');
  // Every source we actually tried failed to reach the network: the device is
  // offline, not the internet. Say the true thing.
  const offline =
    attempted.length > 0 && attempted.every((o) => o.status === 'error' && o.kind === 'network');

  const merged: SearchResult[] = [];
  for (const o of outcomes) if (o.status === 'ok') merged.push(...o.results);

  return {
    query,
    results: rank(merged, query, adapters, opts.weights),
    outcomes,
    ms: Date.now() - started,
    offline,
  };
}
