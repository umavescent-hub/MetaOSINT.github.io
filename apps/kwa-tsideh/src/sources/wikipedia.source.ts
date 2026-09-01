import { sourceId, type SearchResult, type SourceAdapter } from '../core/types';

const ID = sourceId('wikipedia');

interface Hit {
  readonly pageid: number;
  readonly title: string;
  readonly snippet: string;
  readonly timestamp?: string;
}

/** MediaWiki returns HTML-marked snippets; the card renders plain text only. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

const adapter: SourceAdapter = {
  id: ID,
  name: 'Wikipedia',
  kind: 'article',
  homepage: 'https://en.wikipedia.org',
  accent: '#C9C6BF',
  weight: 0.9,
  timeoutMs: 2000,
  minIntervalMs: 300,
  requiresProxy: false,

  async search(query, ctx): Promise<readonly SearchResult[]> {
    const url =
      'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*' +
      `&srsearch=${encodeURIComponent(query)}&srlimit=${ctx.limit}&srprop=snippet|timestamp`;
    const data = await ctx.fetchJson<{ query?: { search?: readonly Hit[] } }>(url);
    return (data.query?.search ?? []).map((hit, i) => ({
      id: `${ID}:${hit.pageid}`,
      sourceId: ID,
      kind: 'article' as const,
      title: hit.title,
      snippet: stripHtml(hit.snippet) || 'Wikipedia article.',
      url: `https://en.wikipedia.org/?curid=${hit.pageid}`,
      publishedAt: hit.timestamp ? Date.parse(hit.timestamp) || undefined : undefined,
      rankHint: i,
      raw: hit,
    }));
  },
};

export default adapter;
