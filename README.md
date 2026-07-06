# CPCProfit

SaaS platforma pre profesionálnych obchodníkov s vozidlami: agregované ceny zo
slovenského trhu, DealScore 0-100 flip príležitosti, história cien inzerátov,
AI generovanie textov inzerátov, sledovanie modelov a porovnania. Konkurenčný produkt k profitie.sk s vlastným brandom a copy, postavený
na modernom Vercel + Next.js stacku.

## Stack

| Vrstva | Voľba |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Štýly | Tailwind v4, shadcn/ui (base-nova preset, Base UI) |
| DB + Auth | Supabase (Postgres, Auth, Storage, RLS) |
| ORM | Drizzle |
| AI | Vercel AI Gateway (anthropic/claude-haiku-4-5 default) |
| Billing | Stripe (Checkout + Customer Portal + webhooky) |
| Email | Resend + React Email |
| Monitoring | Sentry, Vercel Analytics |
| Hosting | Vercel (Fluid Compute) |
| i18n | next-intl (SK default) |

## Quick start

```bash
pnpm install
cp .env.example .env.local      # vyplniť, čo už máte; všetko ostatné má graceful fallback
pnpm dev                         # http://localhost:3000
```

Aplikácia funguje **bez akýchkoľvek credentials**: marketing, auth UI aj
dashboard sa vyrenderujú. App moduly čítajú real Postgres cez
`lib/db/queries/*` a pri nedostupnej DB elegantne degradujú do prázdnych
stavov; AI form bez `AI_GATEWAY_API_KEY` streamuje deterministický demo
výstup.

## Skripty

```
pnpm dev               # Dev server (Turbopack)
pnpm build             # Production build
pnpm start             # Run production build
pnpm lint              # ESLint
pnpm typecheck         # tsc --noEmit
pnpm test              # vitest run (single-pass)
pnpm test:watch        # vitest watch
pnpm format            # Prettier (Tailwind plugin)

# CLI utilities
pnpm tsx scripts/scrape-source.ts autobazar.sk 2   # Scrape 2 pages locally (any registered source)
pnpm tsx scripts/seed-vehicles.ts          # Seed vehicle_makes/models (needs DATABASE_URL)
pnpm drizzle-kit generate --name=...       # Create new migration
pnpm drizzle-kit push                      # Apply schema to Supabase
```

## Štruktúra

```
app/
  (marketing)/           # public landing (vrátane featured deals)
  (auth)/                # /login, /register centred shell (/signup je alias)
  app/                   # auth-gated dashboard (overview, market, trends,
                         # analysis, compare, listings, deals, garage,
                         # watchlist, ai-listing, admin, billing, profile)
  api/
    ai/listing/          # streaming AI generator (per-plan quota)
    cron/*               # 5 Vercel Cron entries (dispatch-scrape,
                         # weekly-maintenance, check-removed,
                         # daily-price-snapshot, detect-sold) + enrich-source
    scrape/[source]      # admin manual scrape trigger
    health               # liveness + integration checks
  auth/{sign-out,reset-password,update-password} # Supabase email+password flow
  legal/{terms,privacy-policy}
components/
  marketing/             # site-header, hero, comparison, features, pricing, faq, cta
  app/                   # kpi-card, charts, mobile-nav, listings-table
  ui/                    # shadcn primitives
  ai/                    # AI listing form
lib/
  auth/                  # Supabase SSR helpers + email/password server actions
                         # (actions.ts), admin allowlist (admin.ts)
  db/{schema,index}.ts   # Drizzle schema + lazy client
  db/queries/            # real Postgres queries pre app moduly (graceful-empty
                         # keď DB nie je dostupná)
  scraping/              # cheerio scraper, normalizers, percentile aggregator
  analytics/             # DealScore 0-100, flip opportunities, snapshots,
                         # sold-detector heuristika
  dedup/                 # repost fingerprinting + clustering
  billing/               # plans, per-plan AI quota (quota.ts), usage tracking
  ai/{index,prompts}.ts  # Gateway model constants + prompt templates
  consent.ts             # cookie consent shape
  rate-limit.ts          # Upstash + memory fallback
  botid.ts               # Vercel BotID wrapper
i18n/request.ts          # next-intl SK loader
messages/sk.json
drizzle/migrations/      # SQL migrations (Drizzle-generated)
scripts/                 # tsx-runnable maintenance scripts + prod cron drivers
                         # (trigger-enrich-loop, trigger-rescrape-loop,
                         # trigger-weekly-maintenance — hit prod s CRON_SECRET)
proxy.ts                 # Next 16 routing middleware (Supabase auth guard)
vercel.json              # Vercel config (5 cron jobs)
sentry.{server,edge}.config.ts + instrumentation.ts
```

## Environment variables

Všetky kľúče sú v `.env.example`. Aplikácia toleruje chýbajúce env premenné —
funkcie závislé od danej integrácie sa elegantne degradujú (DB queries vracajú
prázdne výsledky, AI form demo stream) alebo sa vypnú.

| Premenná | Účel | Kde získať |
|---|---|---|
| `DATABASE_URL` | Postgres pre Drizzle | Supabase → Settings → Database |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Supabase Auth | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operácie | Supabase → Settings → API |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway | Vercel → AI → Gateway |
| `STRIPE_SECRET_KEY` / `_WEBHOOK_SECRET` | Predplatné a fakturácia | Stripe Dashboard |
| `STRIPE_PRICE_*` | Konkrétne plány (Plus/Premium × monthly/yearly) | Stripe → Products |
| `RESEND_API_KEY` | Watchlist alerty + týždenný digest (bez kľúča mock mód — sendy sa len logujú) | Resend → API Keys |
| `EMAIL_FROM` | From adresa notifikácií (default `CPCProfit <onboarding@resend.dev>`) | vlastná doména v Resend |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob upload | Vercel → Storage → Blob |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Rate limiting | Vercel Marketplace → Upstash |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (bez neho sú všetky Sentry captures no-op) | Sentry → Project → Client Keys |
| `SENTRY_AUTH_TOKEN` | Build-time upload source-máp (čitateľné prod stacktrace; bez neho sa ticho preskočí) | Sentry → Settings → Auth Tokens |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Org + project slug pre upload source-máp (project default `cpcprofit`) | Sentry → URL / Project Settings |
| `CRON_SECRET` | Bearer pre `/api/cron/*` | sami vygenerujete (`openssl rand -hex 32`) |
| `ADMIN_EMAILS` | Allowlist pre admin endpointy | comma-separated zoznam |

## Deploy

Plný step-by-step v [`DEPLOY.md`](./DEPLOY.md). TL;DR:

1. `vercel login` + `vercel link` (z Claude Code prompte: `! vercel login`)
2. Marketplace: Supabase + Upstash + AI Gateway + Sentry + Resend + Stripe
3. `vercel env pull .env.local`
4. `pnpm drizzle-kit push && pnpm tsx scripts/seed-vehicles.ts`
5. `vercel deploy --prod`

Architektúra: [`ARCHITECTURE.md`](./ARCHITECTURE.md). Incidenty + údržba:
[`OPERATIONS.md`](./OPERATIONS.md).

## Testy

**Unit (vitest, `pnpm test`)**:
- `lib/scraping/__tests__/aggregate.test.ts` — percentily a snapshot agregátor
- `lib/scraping/__tests__/normalize.test.ts` — SK parsery (cena, km, rok, palivo)
- `lib/scraping/__tests__/robots.test.ts` — robots.txt parser + isAllowed
- `lib/scraping/sources/__tests__/autobazar-sk.test.ts` — fixture-based parsing
- `lib/scraping/sources/__tests__/autobazar-eu.test.ts` + `autobazar-eu-detail.test.ts` — autobazar.eu listing + detail parsing
- `lib/scraping/sources/__tests__/bazos-sk.test.ts` — bazos.sk parsing
- `lib/analytics/__tests__/deal-score.test.ts` — DealScore 0-100 algoritmus
- `lib/analytics/__tests__/snapshots.test.ts` — weekly snapshot výpočty
- `lib/dedup/__tests__/fingerprint.test.ts` — repost fingerprinting
- `lib/db/queries/__tests__/deals.test.ts` — deals query helpers
- `lib/__tests__/rate-limit.test.ts` — token-bucket fallback
- `lib/__tests__/consent.test.ts` — cookies consent v1 parser
- `lib/__tests__/db-bigint.test.ts` — bigint serializácia z DB
- `lib/auth/__tests__/redirect.test.ts` — open-redirect guard
- `lib/ai/__tests__/prompts.test.ts` — system + user prompt builders
- `lib/billing/__tests__/plans.test.ts` — plan ladder + price-id resolution
- `lib/billing/__tests__/quota.test.ts` — quota verdict edge cases
- `app/api/health/__tests__/route.test.ts` — ok/degraded/error semantika

**E2E (Playwright, `pnpm test:e2e`)** — 6 spec súborov pokrývajú marketing,
auth UI, app moduly, deals, AI listing streaming, GDPR cookies banner. Lokálne
vyžaduje `pnpm exec playwright install chromium` (~150 MB) raz; CI to
spraví automaticky.

## Licencia

Proprietárny kód. Nezdielajte mimo dohodnutý okruh kontraktorov a klienta.
