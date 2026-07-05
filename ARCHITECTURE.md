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
 │  - SEO meta  │            │  - lib/db/       │         │  - cron/*        │
 │  - OG image  │            │    queries/*     │         │  - scrape/*      │
 └──────────────┘            └────────┬─────────┘         │  - health        │
                                      │                   │  - stripe/webhook│
                                      │                   └────────┬─────────┘
                                      │                            │
                            ┌─────────▼────────────────────────────▼────────┐
                            │             Supabase Postgres                 │
                            │  - 15 tables, 8 enums, RLS                    │
                            │  - users, subscriptions, listings,            │
                            │    listing_details, listing_photos,           │
                            │    listing_price_history, market_snapshots,   │
                            │    flip_opportunities, garage, watchlist,     │
                            │    ai_listings, events, scrape_runs,          │
                            │    vehicle_makes, vehicle_models              │
                            └────────────────────┬──────────────────────────┘
                                                 │
            ┌────────────────────────────────────┼────────────────────────────┐
            │                                    │                            │
            ▼                                    ▼                            ▼
 ┌──────────────────┐               ┌─────────────────────┐      ┌──────────────────┐
 │ AI Gateway       │               │ Stripe              │      │ Vercel Cron (×5) │
 │ - claude-haiku-  │               │ - Checkout sessions │      │ - dispatch-scrape│
 │   4-5 default    │               │ - Subscription      │      │   (0 */6 * * *)  │
 │ - openai/gpt-5   │               │   webhook           │      │   → cheerio      │
 │   fallback       │               │ - Customer Portal   │      │   scraper priamo │
 │ - Zero data      │               │                     │      │   v route        │
 │   retention      │               │                     │      │ - weekly-maint.  │
 │                  │               │                     │      │ - check-removed  │
 │                  │               │                     │      │ - price-snapshot │
 │                  │               │                     │      │ - detect-sold    │
 └──────────────────┘               └─────────────────────┘      └──────────────────┘
                                                                          │
                                                                          ▼
                                                                 ┌──────────────────┐
                                                                 │ autobazar.sk     │
                                                                 │ autobazar.eu     │
                                                                 │ bazos.sk         │
                                                                 │ + robots.txt     │
                                                                 │   compliance     │
                                                                 └──────────────────┘
                                                                          │
                                                                          ▼
                                                                  Postgres listings
                                                                  + market_snapshots
                                                                  + flip_opportunities
                                                                  (weekly-maintenance)
```

## Request lifecycle

### Anonymous user na `/`

1. Vercel Edge prijme request, aplikuje `next.config.ts` security headers (CSP, HSTS, X-Frame-Options).
2. `proxy.ts` skip pre `/` (nie `/app/*`).
3. Marketing route je static (PPR) — okamžitý HTML response.
4. Klient hydratuje, načíta Recharts iba ak je na page s grafmi.
5. Cookies banner mountne; ak `localStorage.cpcprofit-consent` existuje, banner sa nezobrazí.

### Auth flow (Supabase email + password)

1. User vyplní e-mail + heslo na `/login` (alebo `/register`; `/signup` je alias).
2. Form submitne server action v `lib/auth/actions.ts`:
   - `loginAction` → `supabase.auth.signInWithPassword({ email, password })`,
   - `registerAction` → `supabase.auth.signUp({ email, password })`.
   - `safeNextPath()` validuje `next` (rejectne open-redirect).
   - Supabase chyby sa prekladajú na slovenské hlásenia (`translate()`).
3. Session cookie zapíše `@supabase/ssr`; redirect na `next` / `/app/overview`.
4. Password reset: `/auth/reset-password` → `resetPasswordForEmail()` s
   redirectom na `/auth/update-password`, kde si user nastaví nové heslo.
5. `proxy.ts` na ďalšom requeste verifikuje session cez `supabase.auth.getUser()`.
6. Sign-out cez `app/auth/sign-out/route.ts` (`logoutAction`).

### AI listing generation

1. Authenticated user na `/app/ai-listing` vyplní form a submit.
2. Browser POST `/api/ai/listing` s form data.
3. Server route:
   - `getCurrentUser()` — v prod requires auth (token-burn protection).
   - `rateLimit({ key: user ? userId : ip, limit: user ? 30 : 10, windowMs: 60_000 })`.
   - Zod validácia — malformed_json (400) vs validation_failed (400 + issues).
   - Bez `AI_GATEWAY_API_KEY` → mock stream (deterministic).
   - S kľúčom → per-plan mesačná quota (`lib/billing/quota.ts`), usage sa
     počíta z `ai_listings` (`lib/billing/usage.ts`); po vyčerpaní 429
     `quota_exceeded`.
   - Potom `streamText({ model: 'anthropic/claude-haiku-4-5', ... })` cez AI Gateway.
4. Response je `text/plain` stream; klient číta cez `ReadableStream` reader, append každý token do `<pre>`.
5. Mode badge zobrazí "Demo režim" alebo "Claude Haiku 4.5" podľa `x-cpcprofit-mode` header.

### Stripe subscription flow

1. User na `/app/billing` klikne "Upraviť plán" → redirect na `/#pricing`.
2. Klikne "Zvoliť Plus" → ak nie je auth, redirect na `/register?plan=plus`. Ak je auth, POST na `/api/stripe/checkout` s priceId.
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
2. Route beží **synchrónne priamo vo function invocation** (žiadne queues ani
   sandbox) — iteruje zdroje z `lib/scraping/sources/registry.ts`
   (autobazar.sk, autobazar.eu, bazos.sk) s per-source try/catch izoláciou.
3. Per zdroj (`lib/scraping/scrape.ts`): `runScrape(source, { pages: 30 })`:
   - `ensureAllowed()` fetchne `/robots.txt` (cached 24h), throw `ScrapeForbiddenError` ak Disallow.
   - Per-page fetch s UA `CPCProfit-Bot/0.1`, robots-supplied crawl-delay (alebo 1.5s).
   - Cheerio parsing extrahuje normalizované listingy.
4. `upsertListings()` do `listings` table (deduplikácia podľa `source + source_id`),
   `recordScrapeRun()` zapíše beh do `scrape_runs`.
5. Ak zdroj má `parseDetailPage`: `runEnrichment()` (limit 40/beh) →
   `persistDetails()` naplní `listing_details` + `listing_photos`.
6. Ostatné crony (`vercel.json`) dopĺňajú pipeline:
   - `weekly-maintenance` (Ne 02:00) — fingerprint backfill + repost clustering
     (`lib/dedup`), weekly `market_snapshots`, prepočet `flip_opportunities`
     (DealScore 0-100, `lib/analytics/deal-score.ts`).
   - `check-removed` (03:00) — HEAD-check aktívnych inzerátov, 404/410 →
     `removedAt`.
   - `daily-price-snapshot` (04:00) — denné ceny do `listing_price_history`
     (graf histórie ceny na detaile inzerátu).
   - `detect-sold` (05:00) — heuristika predaných áut (`lib/analytics/sold-detector.ts`).
7. Operačné driver skripty v `scripts/` (`trigger-enrich-loop.mjs`,
   `trigger-rescrape-loop.mjs`, `trigger-weekly-maintenance.mjs`) volajú prod
   endpointy s `CRON_SECRET` pre manuálny catch-up.

## Kľúčové trade-offs

### Server vs client komponenty

- **Server default.** Dashboard pages sú server (SSR + RSC), Recharts grafy sú jediné `'use client'` komponenty.
- **Cookies banner** je `'use client'` lebo potrebuje `localStorage`. `useSyncExternalStore` zaisťuje SSR/CSR alignment bez hydration warningu.
- **Theme toggle** je `'use client'` (next-themes vyžaduje client mount detection).

### DB queries s graceful-empty fallbackom

- Aplikačné moduly (overview, market, trends, analysis, listings, deals...)
  čítajú real Postgres cez `lib/db/queries/*` (dashboard, deals, listings,
  trends, price-history, scrape-runs). `lib/mock` bol odstránený.
- Keď DB nie je dostupná (chýba `DATABASE_URL`, výpadok), queries vracajú
  prázdne výsledky namiesto throw — UI degraduje do empty states a stránka
  sa vyrenderuje aj bez backendu.

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
- sauto.cz bol vyradený zo zdrojov — robots.txt scraping zakazuje.
  mobile.de / autoscout24 sú len možná budúca úvaha, nie sú zapojené.
- Pred GA: právny review ToS u autobazar.sk/.eu a bazos.sk + GDPR statement.

## Deployment topology

- **Region**: Vercel `fra1` (Frankfurt) — minimalizuje latency pre SK trh, GDPR-compliant.
- **Functions**: Fluid Compute (Node.js 22, matchne `engines` pin), default timeout 300s.
- **Cron**: Vercel Cron, 5 jobov definovaných vo `vercel.json` — dispatch-scrape (`0 */6 * * *`), weekly-maintenance (Ne 02:00), check-removed (03:00), daily-price-snapshot (04:00), detect-sold (05:00). **Vyžaduje Pro plán** — Hobby povolí len 1×/deň. Ak je projekt na Hobby, zredukuj crony vo `vercel.json` alebo upgrade.
- **DB**: Supabase Postgres v EÚ regióne, connection pooler na `:6543`, transactional pooling pre route handlers.
- **CDN**: Vercel default, security headers cez `next.config.ts`.

## Stack rozhodnutia (zhrnutie)

| Decision | Why |
|---|---|
| Next.js 16 App Router | RSC, Cache Components, Vercel-native |
| Tailwind v4 + shadcn/ui base-nova | Modern token system, Base UI (lepšie a11y než Radix) |
| Drizzle ORM | Type-safe bez magie, edge-friendly |
| Supabase Auth | E-mail + heslo out-of-box (server actions), RLS pre multi-tenant |
| Vercel AI Gateway | Unified API, fallback, zero data retention, observability |
| Stripe | Standard, EU-ready (SCA, MOSS) |
| Cheerio scraper | Lighter než Playwright, zdroje (autobazar.sk/.eu, bazos.sk) nemajú heavy JS rendering |
| Sentry | Industry standard, source maps, EU region |
| next-intl | Pripravené pre CZ/EN expansion bez prepisovania |
