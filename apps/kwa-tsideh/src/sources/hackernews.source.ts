import { sourceId, type SearchResult, type SourceAdapter } from '../core/types';

const ID = sourceId('hackernews');

interface Hit {
  readonly objectID: string;
  readonly title: string | null;
  readonly story_title: string | null;
  readonly url: string | null;
  readonly author: string;
  readonly points: number | null;
  readonly num_comments: number | null;
  readonly created_at_i: number;
  readonly story_text: string | null;
  readonly comment_text: string | null;
}

const adapter: SourceAdapter = {
  id: ID,
  name: 'Hacker News',
  kind: 'discussion',
  homepage: 'https://news.ycombinator.com',
  accent: '#FF6A2B',
  weight: 0.7,
  timeoutMs: 2000,
  minIntervalMs: 200,
  requiresProxy: false,

  async search(query, ctx): Promise<readonly SearchResult[]> {
    const url =
      'https://hn.algolia.com/api/v1/search' +
      `?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${ctx.limit}`;
    const data = await ctx.fetchJson<{ hits?: readonly Hit[] }>(url);
    return (data.hits ?? [])
      .filter((h) => (h.title ?? h.story_title) !== null)
      .map((hit, i) => {
        const discussion = `https://news.ycombinator.com/item?id=${hit.objectID}`;
        const points = hit.points ?? 0;
        const comments = hit.num_comments ?? 0;
        return {
          id: `${ID}:${hit.objectID}`,
          sourceId: ID,
          kind: 'discussion' as const,
          title: hit.title ?? hit.story_title ?? 'Untitled',
          snippet:
            hit.story_text?.slice(0, 240) ??
            hit.comment_text?.slice(0, 240) ??
            `${points} points, ${comments} comments on Hacker News.`,
          url: hit.url ?? discussion,
          author: hit.author,
          publishedAt: hit.created_at_i * 1000,
          metrics: { points, comments },
          rankHint: i,
          raw: { ...hit, discussion },
        };
      });
  },
};

export default adapter;
