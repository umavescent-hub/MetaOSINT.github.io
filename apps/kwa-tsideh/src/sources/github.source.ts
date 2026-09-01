import { sourceId, type SearchResult, type SourceAdapter } from '../core/types';

const ID = sourceId('github');

interface Repo {
  readonly id: number;
  readonly full_name: string;
  readonly description: string | null;
  readonly html_url: string;
  readonly stargazers_count: number;
  readonly forks_count: number;
  readonly language: string | null;
  readonly pushed_at: string;
  readonly owner: { readonly login: string } | null;
}

const adapter: SourceAdapter = {
  id: ID,
  name: 'GitHub',
  kind: 'repo',
  homepage: 'https://github.com',
  accent: '#8B93FF',
  weight: 0.85,
  timeoutMs: 2200,
  minIntervalMs: 1200,
  requiresProxy: false,

  async search(query, ctx): Promise<readonly SearchResult[]> {
    const url =
      'https://api.github.com/search/repositories' +
      `?q=${encodeURIComponent(query)}&per_page=${ctx.limit}&sort=best-match`;
    const data = await ctx.fetchJson<{ items?: readonly Repo[] }>(url, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    return (data.items ?? []).map((repo, i) => ({
      id: `${ID}:${repo.id}`,
      sourceId: ID,
      kind: 'repo' as const,
      title: repo.full_name,
      snippet: repo.description ?? 'No description provided.',
      url: repo.html_url,
      author: repo.owner?.login,
      publishedAt: Date.parse(repo.pushed_at) || undefined,
      metrics: { stars: repo.stargazers_count, forks: repo.forks_count },
      rankHint: i,
      raw: repo,
    }));
  },
};

export default adapter;
