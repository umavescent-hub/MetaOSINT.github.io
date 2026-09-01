/** Typed transport errors so the UI can say something true about a failure. */
export class HttpError extends Error {
  constructor(readonly status: number, readonly url: string) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}
export class NetworkError extends Error {
  constructor(readonly url: string, cause?: unknown) {
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

export function makeFetchers(signal: AbortSignal): {
  fetchJson: <T>(url: string, init?: RequestInit) => Promise<T>;
  fetchText: (url: string, init?: RequestInit) => Promise<string>;
} {
  const headersOf = (init?: RequestInit): Record<string, string> =>
    (init?.headers as Record<string, string> | undefined) ?? {};
  return {
    fetchJson: async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const res = await request(url, { signal, headers: headersOf(init) });
      return (await res.json()) as T;
    },
    fetchText: async (url: string, init?: RequestInit): Promise<string> => {
      const res = await request(url, { signal, headers: headersOf(init) });
      return await res.text();
    },
  };
}
