import { sourceId, type SearchResult, type SourceAdapter } from '../core/types';

const ID = sourceId('stackexchange');

interface Item {
  readonly question_id: number;
  readonly title: string;
  readonly link: string;
  readonly score: number;
  readonly answer_count: number;
  readonly view_count: number;
  readonly is_answered: boolean;
  readonly creation_date: number;
  readonly tags?: readonly string[];
  readonly owner?: { readonly display_name?: string };
}

function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const adapter: SourceAdapter = {
  id: ID,
  name: 'Stack Overflow',
  kind: 'answer',
  homepage: 'https://stackoverflow.com',
  accent: '#F0973B',
  weight: 0.8,
  timeoutMs: 2200,
  minIntervalMs: 1000,
  requiresProxy: false,

  async search(query, ctx): Promise<readonly SearchResult[]> {
    const url =
      'https://api.stackexchange.com/2.3/search/advanced' +
      `?order=desc&sort=relevance&q=${encodeURIComponent(query)}` +
      `&site=stackoverflow&pagesize=${ctx.limit}`;
    const data = await ctx.fetchJson<{ items?: readonly Item[] }>(url);
    return (data.items ?? []).map((item, i) => ({
      id: `${ID}:${item.question_id}`,
      sourceId: ID,
      kind: 'answer' as const,
      title: decode(item.title),
      snippet:
        (item.tags?.length ? `${item.tags.slice(0, 4).join(' · ')} — ` : '') +
        `${item.answer_count} answer${item.answer_count === 1 ? '' : 's'}` +
        (item.is_answered ? ', accepted' : '') +
        `, score ${item.score}.`,
      url: item.link,
      author: item.owner?.display_name,
      publishedAt: item.creation_date * 1000,
      metrics: { score: item.score, answers: item.answer_count, views: item.view_count },
      rankHint: i,
      raw: item,
    }));
  },
};

export default adapter;
