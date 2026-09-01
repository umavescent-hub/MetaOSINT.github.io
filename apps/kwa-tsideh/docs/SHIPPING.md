# Shipping Kwa Tsideh

Everything between a working app and a listing, in order.

---

## 0. Run it on your phone (no build required)

Every native module in this app — `expo-sqlite`, `expo-haptics`,
`expo-web-browser`, `expo-system-ui`, `expo-router` — is bundled into **Expo
Go**. There is nothing to compile to use the app today.

```bash
cd apps/kwa-tsideh
npm ci
npx expo start          # add --tunnel if phone and laptop are on different networks
```

You only need a development build (step 2) once you add a library Expo Go does
not carry, or when you want the real icon, splash and bundle identifier on the
device.

---

## 1. Accounts and one-time setup

| Item | Cost | Lead time |
| --- | --- | --- |
| Expo account | free | minutes |
| Apple Developer Program | $99/year | hours to ~2 days for approval |
| Google Play Developer | $25 once | hours, plus identity verification |

```bash
npm install -g eas-cli
eas login
eas init            # links this project to your Expo account, writes the project id
```

Google Play additionally requires, for a **personal** developer account, that
20 testers opt into a closed test for 14 continuous days before you may apply
for production access. Start that clock early — it is the single longest pole
in shipping to Android.

---

## 2. Development build (real icon, real bundle id, on-device)

```bash
eas build --profile development --platform all
```

Install the resulting `.apk` directly on Android. For iOS, register the device
first (`eas device:create`), then install the `.ipa` from the build page.
Afterwards, `npx expo start --dev-client` connects to it exactly like Expo Go.

## 3. Preview build (share it with people)

```bash
eas build --profile preview --platform all
```

Internal distribution: a link and a QR code, no store review.

## 4. Production build

```bash
eas build --profile production --platform all
```

`production` uses `appVersionSource: remote` with `autoIncrement`, so EAS owns
the build number and you never hand-edit `versionCode` / `buildNumber` again.
Bump the human-facing `version` in `app.json` for real releases.

---

## 5. Before you submit — QA pass

Run this on both a physical iPhone and a physical Android. Simulators do not
reproduce network failure honestly.

- [ ] Cold launch to first paint under 2s
- [ ] Query with results — feed renders inside the 2.5s budget
- [ ] Query with no results — no-results screen, not a spinner forever
- [ ] **Airplane mode, cold cache** — no-results screen, no crash
- [ ] **Airplane mode, warm cache** — cached results with the offline banner
- [ ] Kill wifi mid-search — partial results, failed sources dimmed
- [ ] Turn every source off in Settings — search is empty, app is stable
- [ ] Save a favorite, force-quit, reopen — still there, opens offline
- [ ] Rotate / largest Dynamic Type — nothing clipped, nothing overlapping
- [ ] VoiceOver and TalkBack — every card and control is announced
- [ ] Dark and light mode on every screen
- [ ] Tap a result → external browser opens → back returns to the feed intact

---

## 6. App Store (iOS)

**Assets**

- [ ] 1024×1024 icon — generated, no alpha, no rounded corners (`assets/icon.png`)
- [ ] Screenshots: 6.7" iPhone required; 6.5" and 5.5" if you support older devices
- [ ] Optional preview video

**Metadata**

- [ ] Name: `Kwa Tsideh` (30 chars max)
- [ ] Subtitle (30 chars): e.g. *One search across six sources*
- [ ] Description, keywords, support URL, marketing URL
- [ ] Primary category: Reference. Secondary: Productivity
- [ ] Age rating questionnaire — note that results are third-party web content

**Compliance**

- [ ] `ITSAppUsesNonExemptEncryption: false` — already set in `app.json`; the app
      uses only standard HTTPS
- [ ] Privacy: **no data collected**. No accounts, no analytics, no tracking, no
      ad identifiers. Queries, history and favorites never leave the device.
      Fill the nutrition label as *Data Not Collected* — and keep it true if you
      ever add telemetry.
- [ ] Privacy policy URL is required even when you collect nothing. Publish one
      on the existing Pages site and link it.

**Two review risks worth naming up front**

1. **Guideline 4.2 — minimum functionality.** Apps that mostly re-present web
   content get rejected. Your defence is the merge and ranking layer: this is
   not six webviews, it is one ranked feed with offline caching, per-source
   failure isolation and a library. Say that in the review notes, in one
   sentence.
2. **Guideline 5.2.2 — third-party content.** You surface results from GitHub,
   Wikipedia, Hacker News, arXiv, Stack Overflow and the Internet Archive
   through their public APIs, link out to the original, and cite the source on
   every card. State that in the review notes too.

```bash
eas submit --profile production --platform ios
```

Fill `submit.production.ios` in `eas.json` first: `appleId`, `ascAppId`,
`appleTeamId`.

---

## 7. Play Store (Android)

**Assets**

- [ ] 512×512 icon
- [ ] 1024×500 feature graphic
- [ ] At least 2 phone screenshots (up to 8)

**Metadata**

- [ ] Short description (80 chars), full description (4000)
- [ ] Category: Books & Reference
- [ ] Content rating questionnaire — declare user-generated / third-party content

**Compliance**

- [ ] Data safety form: no data collected, no data shared, no tracking
- [ ] Privacy policy URL (required)
- [ ] Target API level must meet Google's current floor — Expo SDK 57 is current
- [ ] Closed test: 20 testers, 14 days, personal accounts only

```bash
eas submit --profile production --platform android
```

Needs a Play Console service account JSON at the path in `eas.json`
(`play-service-account.json`). **Do not commit it** — it is already covered by
`.gitignore`.

---

## 8. Secrets

Nothing in this app requires a key today; all six sources are keyless. If you
add a keyed source:

- Never put the key in `.env` as `EXPO_PUBLIC_*` — that ships in the bundle and
  anyone can read it out of the `.hbc`.
- Set `requiresProxy: true` on the adapter, put the key in
  `supabase secrets`, deploy `supabase/functions/search-proxy`, and point
  `EXPO_PUBLIC_PROXY_URL` at it.
- For CI, use `eas secret:create` rather than committing anything.

---

## 9. Regenerating the icons

The mark is generated from code, not a design file:

```bash
npm run icons
```

Edit the geometry or palette in `tools/make-icons.mjs` and re-run. Every size
regenerates from the same source, so they can never drift apart.
