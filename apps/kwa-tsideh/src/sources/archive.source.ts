import { sourceId, type SearchResult, type SourceAdapter } from '../core/types';

const ID = sourceId('archive');

interface Doc {
  readonly identifier: string;
  readonly title?: string | readonly string[];
  readonly description?: string | readonly string[];
  readonly creator?: string | readonly string[];
  readonly mediatype?: string;
  readonly publicdate?: string;
}

/** Internet Archive returns some fields as either a string or an array. */
function first(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : (value as string);
}

const adapter: SourceAdapter = {
  id: ID,
  name: 'Internet Archive',
  kind: 'media',
  homepage: 'https://archive.org',
  accent: '#5FB49C',
  weight: 0.6,
  timeoutMs: 2400,
  minIntervalMs: 800,
  requiresProxy: false,

  async search(query, ctx): Promise<readonly SearchResult[]> {
    const fields = ['identifier', 'title', 'description', 'creator', 'mediatype', 'publicdate']
      .map((f) => `&fl[]=${f}`)
      .join('');
    const url =
      'https://archive.org/advancedsearch.php' +
      `?q=${encodeURIComponent(query)}${fields}` +
      `&rows=${ctx.limit}&page=1&output=json`;
    const data = await ctx.fetchJson<{ response?: { docs?: readonly Doc[] } }>(url);
    return (data.response?.docs ?? []).map((doc, i) => {
      const publicdate = doc.publicdate;
      return {
        id: `${ID}:${doc.identifier}`,
        sourceId: ID,
        kind: 'media' as const,
        title: first(doc.title) ?? doc.identifier,
        snippet: (first(doc.description) ?? `Archived ${doc.mediatype ?? 'item'}.`)
          .replace(/<[^>]+>/g, '')
          .slice(0, 240),
        url: `https://archive.org/details/${doc.identifier}`,
        author: first(doc.creator),
        publishedAt: publicdate ? Date.parse(publicdate) || undefined : undefined,
        rankHint: i,
        raw: doc,
      };
    });
  },
};

export default adapter;
