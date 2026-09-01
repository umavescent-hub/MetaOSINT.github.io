import type { SourceAdapter, SourceId } from './types';

/**
 * Auto-discovery. Every `*.source.ts` in src/sources/ that default-exports a
 * valid SourceAdapter is registered at boot.
 *
 * Adding a source is ONE FILE. No import to add, no registry line to edit, no
 * UI to touch. That is the whole architectural bet -- do not weaken it.
 */
function isAdapter(value: unknown): value is SourceAdapter {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Partial<SourceAdapter>;
  return (
    typeof a.id === 'string' &&
    typeof a.name === 'string' &&
    typeof a.accent === 'string' &&
    typeof a.weight === 'number' &&
    typeof a.timeoutMs === 'number' &&
    typeof a.minIntervalMs === 'number' &&
    typeof a.requiresProxy === 'boolean' &&
    typeof a.search === 'function'
  );
}

function discover(): SourceAdapter[] {
  // NOTE: this must stay a literal `require.context(...)` call. Metro rewrites
  // it at build time; any indirection (a variable, a destructure, a cast on the
  // callee) silently yields an app with zero sources.
  const ctx = require.context('../sources', false, /\.source\.ts$/);
  const found: SourceAdapter[] = [];
  for (const key of ctx.keys()) {
    const mod = ctx<{ default?: unknown }>(key);
    const candidate = mod.default;
    if (isAdapter(candidate)) found.push(candidate);
    else if (__DEV__) console.warn(`[registry] ${key} does not default-export a valid SourceAdapter; skipped.`);
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

let cached: SourceAdapter[] | null = null;

export function allSources(): readonly SourceAdapter[] {
  cached ??= discover();
  return cached;
}

export function sourceById(id: SourceId | string): SourceAdapter | undefined {
  return allSources().find((s) => s.id === id);
}

export function accentOf(id: SourceId | string, fallback: string): string {
  return sourceById(id)?.accent ?? fallback;
}

export function nameOf(id: SourceId | string): string {
  return sourceById(id)?.name ?? String(id);
}
