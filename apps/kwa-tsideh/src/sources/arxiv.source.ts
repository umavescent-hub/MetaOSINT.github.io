import { sourceId, type SearchResult, type SourceAdapter } from '../core/types';

const ID = sourceId('arxiv');

/**
 * arXiv serves Atom XML, not JSON. A dependency-free reader beats pulling an
 * XML parser into the bundle for one source with a fixed, stable schema.
 */
function entries(xml: string): string[] {
  return xml.split('<entry>').slice(1).map((chunk) => chunk.split('</entry>')[0] ?? '');
}

function tag(chunk: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(chunk);
  return (m?.[1] ?? '')
    .replace(/\s+/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function authors(chunk: string): string | undefined {
  const names = [...chunk.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => (m[1] ?? '').trim());
  if (names.length === 0) return undefined;
  return names.length > 2 ? `${names[0]} et al.` : names.join(', ');
}

const adapter: SourceAdapter = {
  id: ID,
  name: 'arXiv',
  kind: 'paper',
  homepage: 'https://arxiv.org',
  accent: '#B03A2E',
  weight: 0.75,
  timeoutMs: 2400,
  // arXiv asks for a polite gap between calls. Honor it.
  minIntervalMs: 3000,
  requiresProxy: false,

  async search(query, ctx): Promise<readonly SearchResult[]> {
    const url =
      'https://export.arxiv.org/api/query' +
      `?search_query=all:${encodeURIComponent(query)}` +
      `&start=0&max_results=${ctx.limit}&sortBy=relevance`;
    const xml = await ctx.fetchText(url, { headers: { Accept: 'application/atom+xml' } });
    return entries(xml).flatMap((chunk, i) => {
      const link = tag(chunk, 'id');
      const title = tag(chunk, 'title');
      if (!link || !title) return [];
      const published = tag(chunk, 'published');
      return [{
        id: `${ID}:${link}`,
        sourceId: ID,
        kind: 'paper' as const,
        title,
        snippet: tag(chunk, 'summary').slice(0, 280) || 'arXiv preprint.',
        url: link,
        author: authors(chunk),
        publishedAt: published ? Date.parse(published) || undefined : undefined,
        rankHint: i,
        raw: { link, published },
      }];
    });
  },
};

export default adapter;
