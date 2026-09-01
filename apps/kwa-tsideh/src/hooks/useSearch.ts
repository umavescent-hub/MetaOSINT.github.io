import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { fanout } from '../core/fanout';
import { allSources } from '../core/registry';
import { rank } from '../core/rank';
import type { FanoutReport, SearchResult } from '../core/types';
import { readCache, writeCache } from '../db/cache';
import { recordSearch } from '../db/library';
import { useSourcePrefs } from '../state/sources';

const proxyUrl = (): string | null => {
  const fromEnv = process.env.EXPO_PUBLIC_PROXY_URL;
  const fromExtra = (Constants.expoConfig?.extra as { proxyUrl?: string } | undefined)?.proxyUrl;
  return fromEnv || fromExtra || null;
};

export interface SearchState extends FanoutReport {
  /** True when every live source failed and we are serving the last good copy. */
  readonly servedFromCache: boolean;
}

const EMPTY: SearchState = {
  query: '',
  results: [],
  outcomes: [],
  ms: 0,
  servedFromCache: false,
};

export function useSearch(query: string): UseQueryResult<SearchState, Error> {
  const enabled = useSourcePrefs((s) => s.enabled);
  const weights = useSourcePrefs((s) => s.weights);
  const trimmed = query.trim();

  return useQuery<SearchState, Error>({
    queryKey: ['search', trimmed, enabled, weights],
    enabled: trimmed.length > 0,
    // Matches the cache TTL: a repeated query inside the window is instant.
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    placeholderData: (prev) => prev ?? EMPTY,
    queryFn: async (): Promise<SearchState> => {
      const report = await fanout(trimmed, { enabled, weights, proxyUrl: proxyUrl() });

      await Promise.all(
        report.outcomes.map((o) =>
          o.status === 'ok' ? writeCache(trimmed, o.sourceId, o.results) : Promise.resolve(),
        ),
      );

      const liveSources = report.outcomes.filter((o) => o.status !== 'skipped');
      const anyLive = report.outcomes.some((o) => o.status === 'ok' && o.results.length > 0);

      // Every live source failed -- fall back to the last good copy rather than
      // showing a blank screen. This is the airplane-mode path.
      if (!anyLive && liveSources.length > 0) {
        const cached = await readCache(trimmed);
        if (cached.length > 0) {
          const ranked: readonly SearchResult[] = rank(cached, trimmed, allSources(), weights);
          await recordSearch(trimmed, ranked.length);
          return { ...report, results: ranked, servedFromCache: true };
        }
      }

      await recordSearch(trimmed, report.results.length);
      return { ...report, servedFromCache: false };
    },
  });
}
