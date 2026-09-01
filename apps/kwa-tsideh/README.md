# Kwa Tsideh

One query. Six sources. One ranked feed.

A meta-search router: your query fans out to every enabled source in parallel,
results are normalized into one shape, merged, deduped and ranked, and rendered
as a single feed. No source can blank the screen, stall the app, or crash it.

## Run it on your phone

```bash
cd apps/kwa-tsideh
npm ci
npx expo start
```

Scan the QR code with **Expo Go** ([iOS](https://apps.apple.com/app/expo-go/id982107779) ·
[Android](https://play.google.com/store/apps/details?id=host.exp.exponent)).
Phone and laptop must be on the same Wi-Fi.

Different networks, or a corporate/hotel network that blocks LAN traffic:

```bash
npx expo start --tunnel
```

## Adding a source

One file. Drop it in `src/sources/`, name it `*.source.ts`, default-export a
`SourceAdapter`. It is registered at boot and appears in the feed, the status
rail, and Settings with no other edit anywhere.

```ts
import { sourceId, type SourceAdapter } from '../core/types';

const ID = sourceId('example');

const adapter: SourceAdapter = {
  id: ID,
  name: 'Example',
  kind: 'article',
  homepage: 'https://example.com',
  accent: '#8B93FF',
  weight: 0.7,        // ranking prior, 0..1, user-tunable
  timeoutMs: 2200,    // this source's slice of the 2.5s budget
  minIntervalMs: 500, // client-side rate-limit floor
  requiresProxy: false,
  async search(query, ctx) {
    const data = await ctx.fetchJson<{ hits: { id: string; name: string; url: string }[] }>(
      `https://api.example.com/search?q=${encodeURIComponent(query)}`,
    );
    return data.hits.map((h, i) => ({
      id: `${ID}:${h.id}`,
      sourceId: ID,
      kind: 'article',
      title: h.name,
      snippet: '',
      url: h.url,
      rankHint: i,
    }));
  },
};

export default adapter;
```

Rules the adapter must respect:

- **Never read a secret.** If the API needs a key, set `requiresProxy: true` and
  route through the proxy. A source needing a proxy is skipped (visibly) until
  one is configured, rather than shipping a key in the bundle.
- **Never catch your own timeout.** `ctx.signal` is aborted by the registry;
  let it throw. The fanout records it as a per-source outcome.
- **Never mutate global state.** The adapter is a pure `query -> results`.

Shipping to the App Store and Play Store: **[docs/SHIPPING.md](docs/SHIPPING.md)**.

## Behavior under failure

| Situation | What the user sees |
| --- | --- |
| One source is slow | It is dropped at its own timeout; everything else renders inside the 2.5s budget |
| One source is down | A dimmed chip reading `down`; the feed is unaffected |
| A source fails 3 times running | It rests for 5 minutes and stops eating the budget; a banner says so, pull-to-refresh wakes it |
| Airplane mode, warm cache | Last saved results with a "No connection" banner |
| Airplane mode, cold cache | A no-results screen with a way back, never a crash |
| A render bug | An error boundary with the message and a "Try again", never a white screen |
| SQLite fails to open | The app runs memory-only; search still works |

Offline is inferred from the failure types themselves: when every source that was
actually attempted fails with a network error, the device is offline. No extra
dependency and no permission prompt to determine it.

## The icon

The mark — six sources converging on one center — is generated from code, not a
design file. `npm run icons` regenerates every size from
`tools/make-icons.mjs`, so they can never drift apart.

## Keyed sources and the proxy

The six defaults need no key. If you add a source that does:

1. Set `requiresProxy: true` on the adapter. Until a proxy is configured it is
   skipped visibly (`needs key` in the status rail) rather than failing.
2. Add it to the allowlist in `supabase/functions/search-proxy/index.ts`, which
   refuses unknown source ids and any host that does not match the one
   registered for that source, so it cannot become an open relay.
3. `supabase secrets set YOUR_API_KEY=...` and
   `supabase functions deploy search-proxy --no-verify-jwt`.
4. Set `EXPO_PUBLIC_PROXY_URL` to the function URL.

The adapter still writes its normal upstream URL. The rewrite to the proxy
happens in `src/core/http.ts`. No key is ever present in the client bundle.

## Architecture

```
app/                 screens (Expo Router)
src/core/types.ts    the SourceAdapter + SearchResult contract
src/core/registry.ts require.context auto-discovery of src/sources/*.source.ts
src/core/fanout.ts   parallel execution, per-source isolation, 2.5s wall budget
src/core/rank.ts     scoring + source interleave
src/sources/         the extension point -- one file per source
src/db/              SQLite: history, favorites, result cache, prefs
```

**Ranking**

```
score = 0.45·textMatch + 0.25·sourceWeight + 0.20·rankDecay + 0.10·recency
```

Deterministic, offline, free. No LLM in the ranking path. Results are deduped by
normalized URL, then interleaved so no source occupies more than three
consecutive slots.

**Failure isolation.** Each source gets its own `AbortController`, its own
try/catch, and its own outcome record (`ok` / `timeout` / `error` / `skipped`).
The status rail shows the truth per source. When every live source fails, the
last good cached copy is served with an offline banner.

## Sources

| Source | Key | Kind |
| --- | --- | --- |
| GitHub | none | repos |
| Wikipedia | none | reference |
| Hacker News | none | discussion |
| arXiv | none | papers |
| Stack Overflow | none | answers |
| Internet Archive | none | media |

Running cost: **$0**. All six are keyless public APIs called directly from the
device — no backend, no bill.
