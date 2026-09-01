import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { fanout } from '../core/fanout';
import { allSources } from '../core/registry';
import { rank } from '../core/rank';
import type { SearchResult, SourceOutcome } from '../core/types';
import { readCache, writeCache } from '../db/cache';
import { wakeAll } from '../db/health';
import { recordSearch } from '../db/library';
import { useSourcePrefs } from '../state/sources';

const proxyUrl = (): string | null => {
  const fromEnv = process.env.EXPO_PUBLIC_PROXY_URL;
  const fromExtra = (Constants.expoConfig?.extra as { proxyUrl?: string } | undefined)?.proxyUrl;
  return fromEnv || fromExtra || null;
};

interface LiveResult {
  readonly results: readonly SearchResult[];
  readonly outcomes: readonly SourceOutcome[];
  readonly ms: number;
  readonly offline: boolean;
  readonly servedFromCache: boolean;
}

export interface SearchView extends LiveResult {
  /** Nothing to show yet and work is in flight. Drives the skeleton. */
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => void;
}

const EMPTY: LiveResult = {
  results: [],
  outcomes: [],
  ms: 0,
  offline: false,
  servedFromCache: false,
};

export function useSearch(query: string): SearchView {
  const enabled = useSourcePrefs((s) => s.enabled);
  const weights = useSourcePrefs((s) => s.weights);
  const trimmed = query.trim();
  const forceRef = useRef(false);

  // Cache probe. Resolves off a local table in a millisecond or two, so a
  // repeated query paints before the network has finished dialling.
  const cached = useQuery<readonly SearchResult[], Error>({
    queryKey: ['cache', trimmed],
    enabled: trimmed.length > 0,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => rank(await readCache(trimmed), trimmed, allSources(), weights),
  });

  const live = useQuery<LiveResult, Error>({
    queryKey: ['search', trimmed, enabled, weights],
    enabled: trimmed.length > 0,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<LiveResult> => {
      const force = forceRef.current;
      forceRef.current = false;
      if (force) await wakeAll();

      const report = await fanout(trimmed, { enabled, weights, proxyUrl: proxyUrl(), force });

      await Promise.all(
        report.outcomes.map((o) =>
          o.status === 'ok' && o.results.length > 0
            ? writeCache(trimmed, o.sourceId, o.results)
            : Promise.resolve(),
        ),
      );

      const gotSomething = report.results.length > 0;
      const attempted = report.outcomes.some((o) => o.status !== 'skipped');

      // Nothing live came back but we tried: serve the last good copy rather
      // than a blank screen. This is the airplane-mode path.
      if (!gotSomething && attempted) {
        const fallback = await readCache(trimmed);
        if (fallback.length > 0) {
          const ranked = rank(fallback, trimmed, allSources(), weights);
          await recordSearch(trimmed, ranked.length);
          return {
            results: ranked,
            outcomes: report.outcomes,
            ms: report.ms,
            offline: report.offline,
            servedFromCache: true,
          };
        }
      }

      await recordSearch(trimmed, report.results.length);
      return {
        results: report.results,
        outcomes: report.outcomes,
        ms: report.ms,
        offline: report.offline,
        servedFromCache: false,
      };
    },
  });

  const refetch = useCallback(() => {
    forceRef.current = true;
    void live.refetch();
  }, [live]);

  const base = live.data ?? EMPTY;
  const showCached = base.results.length === 0 && (cached.data?.length ?? 0) > 0;

  return {
    results: showCached ? (cached.data ?? []) : base.results,
    outcomes: base.outcomes,
    ms: base.ms,
    offline: base.offline,
    servedFromCache: base.servedFromCache || (showCached && live.isFetching),
    isLoading: live.isPending && !showCached && trimmed.length > 0,
    isFetching: live.isFetching,
    isError: live.isError,
    error: live.error,
    refetch,
  };
}
