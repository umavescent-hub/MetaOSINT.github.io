/** Branded id so a raw string can never be passed where a SourceId belongs. */
export type SourceId = string & { readonly __brand: 'SourceId' };
export const sourceId = (s: string): SourceId => s as SourceId;

export type ResultKind = 'repo' | 'article' | 'paper' | 'discussion' | 'answer' | 'media';

/**
 * The one canonical result shape. Every adapter returns this and the UI knows
 * nothing else. Adding a source can never change this type.
 */
export interface SearchResult {
  /** `${sourceId}:${nativeId}` -- globally unique and stable across sessions. */
  readonly id: string;
  readonly sourceId: SourceId;
  readonly kind: ResultKind;
  readonly title: string;
  readonly snippet: string;
  readonly url: string;
  readonly author?: string;
  /** Epoch ms. Omit when the source has no date -- ranking stays neutral. */
  readonly publishedAt?: number;
  readonly thumbnailUrl?: string;
  /** Source-native signals: stars, points, citations, answers. */
  readonly metrics?: Readonly<Record<string, number>>;
  /** 0-based position in the source's own ordering. */
  readonly rankHint: number;
  /** Source payload for the detail screen. Ranking must never read this. */
  readonly raw?: unknown;
}

export interface SearchContext {
  /** The registry owns the timeout. Adapters just forward this. */
  readonly signal: AbortSignal;
  readonly limit: number;
  readonly fetchJson: <T>(url: string, init?: RequestInit) => Promise<T>;
  readonly fetchText: (url: string, init?: RequestInit) => Promise<string>;
}

/**
 * The extension point. One file in src/sources/ implementing this is a source.
 * No registry edit, no UI change.
 */
export interface SourceAdapter {
  readonly id: SourceId;
  readonly name: string;
  readonly kind: ResultKind;
  readonly homepage: string;
  /** One hex. Drives the chip and the card's source rail. */
  readonly accent: string;
  /** 0..1 ranking prior. Tunable by the user in Settings. */
  readonly weight: number;
  readonly timeoutMs: number;
  /** Client-side floor between calls to this source. */
  readonly minIntervalMs: number;
  /** True => must be routed through the proxy; never called directly. */
  readonly requiresProxy: boolean;
  search(query: string, ctx: SearchContext): Promise<readonly SearchResult[]>;
}

export type SourceOutcome =
  | { readonly status: 'ok'; readonly sourceId: SourceId; readonly results: readonly SearchResult[]; readonly ms: number; readonly fromCache: boolean }
  | { readonly status: 'error'; readonly sourceId: SourceId; readonly error: string; readonly ms: number }
  | { readonly status: 'timeout'; readonly sourceId: SourceId; readonly ms: number }
  | { readonly status: 'skipped'; readonly sourceId: SourceId; readonly reason: 'disabled' | 'no-proxy' };

export interface FanoutReport {
  readonly query: string;
  readonly results: readonly SearchResult[];
  readonly outcomes: readonly SourceOutcome[];
  readonly ms: number;
}
