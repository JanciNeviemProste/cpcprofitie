# Architecture — CPCProfit

High-level pohľad na komponenty, dátový tok a kľúčové trade-offs.

## System diagram

```
                         ┌──────────────────────────────┐
                         │      Browser (React 19)      │
                         │  - Dark/light theme          │
                         │  - Cookies banner            │
                         │  - Streaming AI output       │
                         └──────────────┬───────────────┘
                                        │
                         HTTPS (CSP, HSTS, Referrer-Policy)
                                        │
                         ┌──────────────▼───────────────┐
                         │   Vercel Edge / Fluid Compute │
                         │   - proxy.ts (auth guard)     │
                         │   - Security headers          │
                         │   - BotID (auth, AI endpoints)│
                         └──────────────┬───────────────┘
                                        │
        ┌───────────────────────────────┼─────────────────────────────┐
        │                               │                             │
        ▼                               ▼                             ▼
 ┌──────────────┐            ┌──────────────────┐         ┌──────────────────┐
 │ Marketing /  │            │  /app/* (auth)   │         │   /api/*         │
 │ /legal/*     │            │  - SSR pages     │         │  - stripe/*      │
 │  - Static    │            │  - Recharts CSR  │         │  - ai/listing    │
 │  - SEO meta  │            │  - mock data UI  │         │  - cron/*        │
 │  - OG image  │            │                  │         │  - scrape/*      │
 └──────────────┘            └────────┬─────────┘         │  - health        │
                                      │                   │  - stripe/webhook│
                                      │                   └────────┬─────────┘
                                      │                            │
                            ┌─────────▼────────────────────────────▼────────┐
                            │             Supabase Postgres                 │
                            │  - 11 tables, 6 enums, RLS                    │
                            │  - users, subscriptions, listings,            │
                            │    market_snapshots, garage, watchlist,       │
                            │    ai_listings, events, scrape_runs,          │
                            │    vehicle_makes, vehicle_models              │
                            └────────────────────┬──────────────────────────┘
                                                 │
            ┌────────────────────────────────────┼────────────────────────────┐
            │                                    │                            │
            ▼                                    ▼                            ▼
 ┌──────────────────┐               ┌─────────────────────┐      ┌──────────────────┐
 │ AI Gateway       │               │ Stripe              │      │ Vercel Cron      │
 │ - claude-haiku-  │               │ - Checkout sessions │      │ - 0 */6 * * *    │
 │   4-5 default    │               │ - Subscription      │      │ - dispatch-scrape│
 │ - openai/gpt-5   │               │   webhook           │      │   → Queues       │
 │   fallback       │               │ - Customer Portal   │      │   → Sandbox      │
 │ - Zero data      │               │                     │      │   → Playwright   │
 │   retention      │               │                     │      │   scraper        │
 └──────────────────┘               └─────────────────────┘      └──────────────────┘
                                                                          │
                                                                          ▼
                                                                 ┌──────────────────┐
                                                                 │ autobazar.sk     │
                                                                 │ mobile.de (V2)   │
                                                                 │ autoscout24 (V2) │
                                                                 │ + robots.txt     │
                                                                 │   compliance     │
                                                                 └──────────────────┘
                                                                          │
                                                                          ▼
                                                                  Postgres listings
                                                                  + market_snapshots
                                                                  aggregator (nightly)
```

## Request lifecycle

### Anonymous user na `/`

1. Vercel Edge prijme request, aplikuje `next.config.ts` security headers (CSP, HSTS, X-Frame-Options).
2. `proxy.ts` skip pre `/` (nie `/app/*`).
3. Marketing route je static (PPR) — okamžitý HTML response.
4. Klient hydratuje, načíta Recharts iba ak je na page s grafmi.
5. Cookies banner mountne; ak `localStorage.cpcprofit-consent` existuje, banner sa nezobrazí.

### Auth flow (Google OAuth)

1. User klikne "Pokračovať s Google" na `/login`.
2. Browser Supabase client vyvolá `signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })`.
3. Google OAuth screen → user povolí → redirect na `/auth/callback?code=...&next=/app/overview`.
4. Server route `app/auth/callback/route.ts`:
   - `safeNextPath()` validuje `next` (rejectne open-redirect).
   - `checkBotIdSafe()` — BotID gate (no-op kým VERCEL_BOTID_ENABLED nie je 1).
   - `supabase.auth.exchangeCodeForSession(code)` — vytvorí session cookie.
   - Redirect na `next` (validovaný path).
5. `proxy.ts` na ďalšom requeste verifikuje session cez `supabase.auth.getUser()`.

### AI listing generation

1. Authenticated user na `/app/ai-listing` vyplní form a submit.
2. Browser POST `/api/ai/listing` s form data.
3. Server route:
   - `getCurrentUser()` — v prod requires auth (token-burn protection).
   - `rateLimit({ key: user ? userId : ip, limit: user ? 30 : 10, windowMs: 60_000 })`.
   - Zod validácia — malformed_json (400) vs validation_failed (400 + issues).
   - Bez `AI_GATEWAY_API_KEY` → mock stream (deterministic).
   - S kľúčom → `streamText({ model: 'anthropic/claude-haiku-4-5', ... })` cez AI Gateway.
4. Response je `text/plain` stream; klient číta cez `ReadableStream` reader, append každý token do `<pre>`.
5. Mode badge zobrazí "Demo režim" alebo "Claude Haiku 4.5" podľa `x-cpcprofit-mode` header.

### Stripe subscription flow

1. User na `/app/billing` klikne "Upraviť plán" → redirect na `/#pricing`.
2. Klikne "Zvoliť Plus" → ak nie je auth, redirect na `/signup?plan=plus`. Ak je auth, POST na `/api/stripe/checkout` s priceId.
3. Server route:
   - Auth required.
   - Zod validuje `priceId` (musí matchnúť známy price v PLANS map).
   - `stripe.checkout.sessions.create({ mode: 'subscription', metadata: { userId } })`.
   - Vráti URL → klient redirect.
4. User na hosted Stripe Checkout zaplatí.
5. Stripe pošle `customer.subscription.created` na `/api/stripe/webhook`:
   - Signature verification cez `stripe.webhooks.constructEvent`.
   - `upsertSubscription()` zapíše do `subscriptions` table.
6. User redirect na `/app/billing?status=success`. Page znova načíta — `getUserSubscription()` vráti aktívne predplatné.

### Scraping pipeline

1. Vercel Cron triggne `GET /api/cron/dispatch-scrape` každých 6h s `Authorization: Bearer ${CRON_SECRET}`.
2. Dispatcher rozhodí joby do Vercel Queues (TODO — momentálne len enqueue stub).
3. Worker consumer (Vercel Sandbox) zoberie job → `scrapeAutobazarSk({ pages: 50 })`:
   - `ensureAllowed()` fetchne `/robots.txt` (cached 24h), throw `ScrapeForbiddenError` ak Disallow.
   - Per-page fetch s UA `CPCProfit-Bot/0.1`, robots-supplied crawl-delay (alebo 1.5s).
   - `parseListingsPage()` extrahuje normalizované listingy.
4. Upsert do `listings` table (deduplikácia podľa `source + source_id`).
5. Po batch-i agregátor `computeSnapshot()` prepočíta `market_snapshots` per (model, region, period).
6. Notifikačný job pre `watchlist` matches → Resend e-mail.

## Kľúčové trade-offs

### Server vs client komponenty

- **Server default.** Dashboard pages sú server (SSR + RSC), Recharts grafy sú jediné `'use client'` komponenty.
- **Cookies banner** je `'use client'` lebo potrebuje `localStorage`. `useSyncExternalStore` zaisťuje SSR/CSR alignment bez hydration warningu.
- **Theme toggle** je `'use client'` (next-themes vyžaduje client mount detection).

### Mock dáta vs DB

- Aplikačné moduly (overview, market, analysis...) momentálne čítajú zo `lib/mock/index.ts` — deterministický mulberry32 RNG seedovaný hashom modelového slugu, fixed time anchor (2026-05-04) pre SSR/CSR konzistenciu.
- Po prvom scrape behu (ktorý naplní `listings` + `market_snapshots`) treba prepojiť pages na real DB queries cez `lib/db/queries/*` (ďalšia iterácia).

### Auth fail-open vs fail-closed

- **Dev** (`VERCEL_ENV !== 'production'`): proxy a getCurrentUser fail-open keď Supabase env chýba — UI demo funguje aj bez backendu.
- **Prod** (`VERCEL_ENV === 'production'`): proxy redirect na `/login?error=auth_unavailable`, AI listing route 401 keď chýba auth + `AI_GATEWAY_API_KEY`.

### Rate-limit fallback

- Bez Upstash env: in-memory `Map` per worker. Funguje v dev a single-region preview, **neposkytuje žiadnu ochranu v multi-region prod**.
- Po pridaní `UPSTASH_REDIS_REST_*`: pipeline INCR + PEXPIRE so cross-region zdielaním. Fail-open na infra chyby (loguje, nepadá).

### Scraping legal posture

- UA identifikuje bot, kontakt v `+https://cpcprofit.sk/bot`.
- robots.txt fetch + parse + honour pred prvou stránkou.
- Crawl-delay sa ber väčší z (caller option, robots-suplied), default 1.5s.
- Žiadne PII (telefón, e-mail, meno) sa neukladá.
- Pred GA: právny review ToS u autobazar.sk + GDPR statement.

## Deployment topology

- **Region**: Vercel `fra1` (Frankfurt) — minimalizuje latency pre SK trh, GDPR-compliant.
- **Functions**: Fluid Compute (Node.js 22, matchne `engines` pin), default timeout 300s.
- **Cron**: Vercel Cron, 1× každých 6h pre scrape dispatch.
- **DB**: Supabase Postgres v EÚ regióne, connection pooler na `:6543`, transactional pooling pre route handlers.
- **CDN**: Vercel default, security headers cez `next.config.ts`.

## Stack rozhodnutia (zhrnutie)

| Decision | Why |
|---|---|
| Next.js 16 App Router | RSC, Cache Components, Vercel-native |
| Tailwind v4 + shadcn/ui base-nova | Modern token system, Base UI (lepšie a11y než Radix) |
| Drizzle ORM | Type-safe bez magie, edge-friendly |
| Supabase Auth | Google OAuth out-of-box, RLS pre multi-tenant |
| Vercel AI Gateway | Unified API, fallback, zero data retention, observability |
| Stripe | Standard, EU-ready (SCA, MOSS) |
| Cheerio scraper | Lighter než Playwright, autobazar.sk nemá heavy JS rendering |
| Sentry | Industry standard, source maps, EU region |
| next-intl | Pripravené pre CZ/EN expansion bez prepisovania |
