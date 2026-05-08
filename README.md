# CPCProfit

SaaS platforma pre profesionálnych obchodníkov s vozidlami: agregované ceny zo
slovenského trhu, AI generovanie textov inzerátov, sledovanie modelov a
porovnania. Konkurenčný produkt k profitie.sk s vlastným brandom a copy, postavený
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

Aplikácia funguje **bez akýchkoľvek credentials** v UI-only móde: marketing,
auth UI, dashboard, AI form aj scraper sú prístupné a používajú deterministické
mock dáta.

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
pnpm tsx scripts/scrape-autobazar.ts 2     # Scrape 2 pages locally
pnpm tsx scripts/seed-vehicles.ts          # Seed vehicle_makes/models (needs DATABASE_URL)
pnpm drizzle-kit generate --name=...       # Create new migration
pnpm drizzle-kit push                      # Apply schema to Supabase
```

## Štruktúra

```
app/
  (marketing)/           # public landing
  (auth)/                # /login, /signup centred shell
  app/                   # auth-gated dashboard (overview, market, analysis,
                         # compare, garage, watchlist, ai-listing, admin,
                         # billing, profile)
  api/
    ai/listing/          # streaming AI generator
    cron/dispatch-scrape # Vercel Cron entry
    scrape/autobazar     # admin manual scrape trigger
    health               # liveness + integration checks
  auth/{callback,sign-out} # Supabase OAuth flow
  legal/{terms,privacy-policy}
components/
  marketing/             # site-header, hero, comparison, features, pricing, faq, cta
  app/                   # kpi-card, charts, mobile-nav, listings-table
  ui/                    # shadcn primitives
  ai/                    # AI listing form
lib/
  auth/                  # Supabase SSR helpers (graceful null fallback)
  db/{schema,index}.ts   # Drizzle schema + lazy client
  scraping/              # cheerio scraper, normalizers, percentile aggregator
  ai/{index,prompts}.ts  # Gateway model constants + prompt templates
  consent.ts             # cookie consent shape
  rate-limit.ts          # Upstash + memory fallback
  botid.ts               # Vercel BotID wrapper
  mock/                  # deterministic seeded mock data
i18n/request.ts          # next-intl SK loader
messages/sk.json
drizzle/migrations/      # SQL migrations (Drizzle-generated)
scripts/                 # tsx-runnable maintenance scripts
proxy.ts                 # Next 16 routing middleware (Supabase auth guard)
vercel.ts                # Vercel typed config (crons, cache headers)
sentry.{server,edge}.config.ts + instrumentation.ts
```

## Environment variables

Všetky kľúče sú v `.env.example`. Aplikácia toleruje chýbajúce env premenné —
funkcie závislé od daného integráciu sa elegantne degradujú do mock módu alebo
sa vypnú.

| Premenná | Účel | Kde získať |
|---|---|---|
| `DATABASE_URL` | Postgres pre Drizzle | Supabase → Settings → Database |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Supabase Auth | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operácie | Supabase → Settings → API |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway | Vercel → AI → Gateway |
| `STRIPE_SECRET_KEY` / `_WEBHOOK_SECRET` | Predplatné a fakturácia | Stripe Dashboard |
| `STRIPE_PRICE_*` | Konkrétne plány (Plus/Premium × monthly/yearly) | Stripe → Products |
| `RESEND_API_KEY` | Transakčné e-maily | Resend → API Keys |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob upload | Vercel → Storage → Blob |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Rate limiting | Vercel Marketplace → Upstash |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error tracking | Sentry → Project → Client Keys |
| `CRON_SECRET` | Bearer pre `/api/cron/*` | sami vygenerujete (`openssl rand -hex 32`) |
| `ADMIN_EMAILS` | Allowlist pre admin endpointy | comma-separated zoznam |

## Deploy

1. `vercel link` (po `! vercel login`) prepojí lokálny adresár s Vercel projektom.
2. Cez Vercel Marketplace pridať: **Supabase**, **Upstash Redis**, **Stripe**,
   **AI Gateway**, **Sentry**. Marketplace auto-provisne väčšinu env premenných.
3. `vercel env pull .env.local` stiahne env zo všetkých prostredí.
4. `pnpm drizzle-kit push` aplikuje schému do Supabase Postgres.
5. V Supabase dashboarde povoliť Google OAuth provider, redirect URL
   `<APP_URL>/auth/callback`.
6. Vytvoriť Stripe products (Plus + Premium, monthly + yearly), price IDs uložiť
   do env.
7. `vercel deploy` pre preview, `vercel deploy --prod` pre produkciu.

## Testy

Vitest pokrýva čisté funkcie v `lib/`:
- `lib/scraping/__tests__/aggregate.test.ts` — percentily a snapshot agregátor
- `lib/scraping/__tests__/normalize.test.ts` — SK parsery (cena, km, rok, palivo)
- `lib/__tests__/rate-limit.test.ts` — token-bucket fallback
- `lib/ai/__tests__/prompts.test.ts` — system + user prompt builders

UI je verifikované manuálnym click-throughom; E2E (Playwright) je naplánované
pre Fázu launch.

## Licencia

Proprietárny kód. Nezdielajte mimo dohodnutý okruh kontraktorov a klienta.
