import { create } from 'zustand';
import { allSources } from '../core/registry';
import { readPref, writePref } from '../db/schema';

const KEY_ENABLED = 'sources.enabled';
const KEY_WEIGHTS = 'sources.weights';

interface SourcePrefsState {
  readonly enabled: Readonly<Record<string, boolean>>;
  readonly weights: Readonly<Record<string, number>>;
  readonly hydrated: boolean;
  hydrate: () => Promise<void>;
  toggle: (id: string) => void;
  setWeight: (id: string, weight: number) => void;
  reset: () => void;
}

export const useSourcePrefs = create<SourcePrefsState>((set, get) => ({
  enabled: {},
  weights: {},
  hydrated: false,

  hydrate: async () => {
    const [enabled, weights] = await Promise.all([
      readPref<Record<string, boolean>>(KEY_ENABLED, {}),
      readPref<Record<string, number>>(KEY_WEIGHTS, {}),
    ]);
    set({ enabled, weights, hydrated: true });
  },

  toggle: (id) => {
    const current = get().enabled[id] ?? true;
    const next = { ...get().enabled, [id]: !current };
    set({ enabled: next });
    void writePref(KEY_ENABLED, next);
  },

  setWeight: (id, weight) => {
    const next = { ...get().weights, [id]: Math.max(0, Math.min(1, weight)) };
    set({ weights: next });
    void writePref(KEY_WEIGHTS, next);
  },

  reset: () => {
    set({ enabled: {}, weights: {} });
    void writePref(KEY_ENABLED, {});
    void writePref(KEY_WEIGHTS, {});
  },
}));

/** A source is on unless the user has explicitly turned it off. */
export function isEnabled(enabled: Readonly<Record<string, boolean>>, id: string): boolean {
  return enabled[id] !== false;
}

export function enabledCount(enabled: Readonly<Record<string, boolean>>): number {
  return allSources().filter((s) => isEnabled(enabled, s.id)).length;
}
