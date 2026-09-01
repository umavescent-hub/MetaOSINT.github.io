/**
 * Credential-holding proxy for keyed sources.
 *
 * The client never sees a key. An adapter with `requiresProxy: true` builds its
 * normal upstream URL; the app rewrites it to:
 *
 *   POST/GET  <proxy>/<sourceId>?url=<encoded upstream url>
 *
 * Deploy:  supabase functions deploy search-proxy --no-verify-jwt
 * Secrets: supabase secrets set BRAVE_API_KEY=...
 * Then set EXPO_PUBLIC_PROXY_URL to the function's URL.
 *
 * Not used by the six default sources -- they are keyless and called directly.
 */

/** Allowlist by source id. An unknown id, or a host that does not match, is
 *  refused: this proxy must never become an open relay. */
const SOURCES: Record<string, { host: string; header: (key: string) => Record<string, string>; secret: string }> = {
  brave: {
    host: 'api.search.brave.com',
    secret: 'BRAVE_API_KEY',
    header: (key) => ({ 'X-Subscription-Token': key, Accept: 'application/json' }),
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const requestUrl = new URL(req.url);
  const sourceId = requestUrl.pathname.split('/').filter(Boolean).pop() ?? '';
  const source = SOURCES[sourceId];
  if (!source) return fail(404, `Unknown source: ${sourceId}`);

  const target = requestUrl.searchParams.get('url');
  if (!target) return fail(400, 'Missing url parameter');

  let upstream: URL;
  try {
    upstream = new URL(target);
  } catch {
    return fail(400, 'Malformed url parameter');
  }
  if (upstream.protocol !== 'https:') return fail(400, 'Only https upstreams are allowed');
  if (upstream.hostname !== source.host) {
    return fail(403, `${sourceId} may only be proxied to ${source.host}`);
  }

  const key = Deno.env.get(source.secret);
  if (!key) return fail(503, `${source.secret} is not configured`);

  try {
    const res = await fetch(upstream.toString(), { headers: source.header(key) });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...CORS, 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch {
    return fail(502, 'Upstream unreachable');
  }
});
