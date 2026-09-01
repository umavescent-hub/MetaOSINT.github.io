import type { SearchResult, SourceAdapter, SourceId } from './types';

const STOP = new Set(['the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'and', 'or', 'is', 'how', 'what']);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Title matches count double -- a hit in the title is a hit in the thing. */
function textMatch(result: SearchResult, queryTokens: readonly string[]): number {
  if (queryTokens.length === 0) return 0.5;
  const title = result.title.toLowerCase();
  const snippet = result.snippet.toLowerCase();
  let score = 0;
  for (const t of queryTokens) {
    if (title.includes(t)) score += 2;
    else if (snippet.includes(t)) score += 1;
  }
  return Math.min(1, score / (queryTokens.length * 2));
}

/** Respect each source's own ordering, with diminishing trust down the list. */
function rankDecay(result: SearchResult): number {
  return 1 / (1 + result.rankHint * 0.35);
}

/** Undated sources sit at neutral 0.5 rather than being punished. */
function recency(result: SearchResult, now: number): number {
  if (result.publishedAt === undefined) return 0.5;
  const days = Math.max(0, (now - result.publishedAt) / 86_400_000);
  return 1 / (1 + Math.log10(1 + days));
}

export function scoreOf(
  result: SearchResult,
  queryTokens: readonly string[],
  weightOf: (id: SourceId) => number,
  now: number,
): number {
  return (
    0.45 * textMatch(result, queryTokens) +
    0.25 * weightOf(result.sourceId) +
    0.2 * rankDecay(result) +
    0.1 * recency(result, now)
  );
}

/**
 * No more than MAX_RUN consecutive results from one source in the head of the
 * feed, so six lists read as one feed instead of six stapled lists.
 */
const MAX_RUN = 3;

function interleave(sorted: readonly SearchResult[]): SearchResult[] {
  const out: SearchResult[] = [];
  const held: SearchResult[] = [];
  let runId: SourceId | null = null;
  let run = 0;
  for (const r of sorted) {
    if (r.sourceId === runId && run >= MAX_RUN) {
      held.push(r);
      continue;
    }
    if (r.sourceId === runId) run += 1;
    else {
      runId = r.sourceId;
      run = 1;
    }
    out.push(r);
    // Pull back anything held whose source is no longer the running one.
    for (let i = held.length - 1; i >= 0; i--) {
      const h = held[i];
      if (h && h.sourceId !== runId) {
        held.splice(i, 1);
        out.push(h);
        runId = h.sourceId;
        run = 1;
      }
    }
  }
  return out.concat(held);
}

export function rank(
  results: readonly SearchResult[],
  query: string,
  adapters: readonly SourceAdapter[],
  weightOverrides: Readonly<Record<string, number>> = {},
): SearchResult[] {
  const now = Date.now();
  const tokens = tokenize(query);
  const defaults = new Map<SourceId, number>(adapters.map((a) => [a.id, a.weight]));
  const weightOf = (id: SourceId): number => weightOverrides[id] ?? defaults.get(id) ?? 0.5;

  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    const key = r.url.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sorted = [...deduped].sort(
    (a, b) => scoreOf(b, tokens, weightOf, now) - scoreOf(a, tokens, weightOf, now),
  );
  return interleave(sorted);
}
