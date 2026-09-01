/** Typed transport errors so the UI can say something true about a failure. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}
export class NetworkError extends Error {
  constructor(
    readonly url: string,
    cause?: unknown,
  ) {
    super('Network unreachable');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

const UA = 'KwaTsideh/0.1 (+https://github.com/umavescent-hub)';

interface RequestOptions {
  readonly signal: AbortSignal;
  readonly headers?: Readonly<Record<string, string>>;
  /** Retries only on 429/5xx/network. Never on 4xx -- a bad query is not flaky. */
  readonly retries?: number;
}

async function request(url: string, opts: RequestOptions): Promise<Response> {
  const retries = opts.retries ?? 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(url, {
        signal: opts.signal,
        headers: { Accept: 'application/json', 'User-Agent': UA, ...opts.headers },
      });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        lastErr = new HttpError(res.status, url);
      } else {
        throw new HttpError(res.status, url);
      }
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err instanceof Error && err.name === 'AbortError') throw err;
      lastErr = new NetworkError(url, err);
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new NetworkError(url);
}

/**
 * Keyed sources never see a key. The adapter builds its normal upstream URL and
 * this rewrites it to the proxy, which holds the credential server-side.
 */
export interface ProxyConfig {
  readonly baseUrl: string;
  readonly sourceId: string;
}

function route(url: string, proxy: ProxyConfig | null): string {
  if (!proxy) return url;
  const base = proxy.baseUrl.replace(/\/$/, '');
  return `${base}/${encodeURIComponent(proxy.sourceId)}?url=${encodeURIComponent(url)}`;
}

export function makeFetchers(
  signal: AbortSignal,
  proxy: ProxyConfig | null = null,
): {
  fetchJson: <T>(url: string, init?: RequestInit) => Promise<T>;
  fetchText: (url: string, init?: RequestInit) => Promise<string>;
} {
  const headersOf = (init?: RequestInit): Record<string, string> =>
    (init?.headers as Record<string, string> | undefined) ?? {};
  return {
    fetchJson: async <T>(url: string, init?: RequestInit): Promise<T> => {
      const res = await request(route(url, proxy), { signal, headers: headersOf(init) });
      return (await res.json()) as T;
    },
    fetchText: async (url: string, init?: RequestInit): Promise<string> => {
      const res = await request(route(url, proxy), { signal, headers: headersOf(init) });
      return await res.text();
    },
  };
}
