import { create } from 'zustand';
import type { SearchResult } from '../core/types';

interface SessionState {
  readonly byId: Readonly<Record<string, SearchResult>>;
  remember: (results: readonly SearchResult[]) => void;
  get: (id: string) => SearchResult | undefined;
}

/**
 * In-memory index of everything seen this session, so the detail screen opens
 * instantly without a round trip. SQLite is the fallback, not the fast path.
 */
export const useSession = create<SessionState>((set, get) => ({
  byId: {},
  remember: (results) => {
    if (results.length === 0) return;
    const next: Record<string, SearchResult> = { ...get().byId };
    for (const r of results) next[r.id] = r;
    set({ byId: next });
  },
  get: (id) => get().byId[id],
}));
