# Deploy guide — CPCProfit

Step-by-step od čistého repa po `cpcprofit.sk` v produkcii. Trvá ~60 min ak
máš všetky účty pripravené.

## 0. Pre-requisites

- Vercel účet — **Pro plán je potrebný** ak chceš sub-daily cron (`0 */6 * * *` v `vercel.ts`). Hobby/Free limit je 1 cron/deň → import na Hobby zlyhá s "Hobby accounts are limited to daily cron jobs". Pre Hobby buď upgrade alebo zmeň cron na `0 4 * * *` (1× denne). Vercel Queues a Sandbox tiež vyžadujú Pro.
- Stripe účet (Test mode na začiatku)
- Resend účet (transakčný e-mail)
- Sentry účet (alebo skip — Sentry je optional)
- Doména (`cpcprofit.sk` alebo klientova) — registrovaná u registrátora alebo cez Vercel Domains
- `pnpm@10`, `node@22`, Vercel CLI lokálne

> Z Claude Code prompte spusti `! vercel login` (znak `!` je prefix Claude Code prompte
> pre shell-pass-through, **nie** súčasť bashu). V štandardnom termináli použi
> len `vercel login`.

## 1. Vercel link

```bash
vercel login             # OAuth v prehliadači
vercel link              # bind tento adresár na Vercel projekt (vytvorí nový alebo pripojí existujúci)
```

Po linkovaní vznikne `.vercel/project.json` (gitignored).

## 2. Marketplace integrácie

Vercel Dashboard → tvoj projekt → **Storage** / **Integrations**:

| Integrácia | Čo provisne | Env premenné |
|---|---|---|
| **Supabase** | Postgres + Auth + Storage v EÚ regióne | `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Upstash Redis** | Rate-limiting backend | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **AI Gateway** | Unified LLM API (Anthropic + OpenAI fallback) | `AI_GATEWAY_API_KEY` |
| **Sentry** | Error tracking | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` |
| **Resend** | Transakčný e-mail | `RESEND_API_KEY` |
| **Stripe** (Marketplace alebo manuálne) | Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

## 3. Manuálne env premenné

V Vercel → Settings → Environment Variables pridaj ručne:

```
NEXT_PUBLIC_APP_URL          = https://cpcprofit.sk
RESEND_FROM_EMAIL            = no-reply@cpcprofit.sk
CRON_SECRET                  = <openssl rand -hex 32>
ADMIN_EMAILS                 = jan@cpcprofit.sk,druhy@cpcprofit.sk
SENTRY_TRACES_SAMPLE_RATE    = 0.1
VERCEL_BOTID_ENABLED         = 1   # ak BotID enable v projekte
```

## 4. Stripe products

Stripe Dashboard → **Products → + Add product**:

| Produkt | Mesačne | Ročne |
|---|---|---|
| Plus | €19 / mes | €190 / rok |
| Premium | €49 / mes | €490 / rok |

Každá cena má svoje **Price ID** (`price_...`). Skopíruj do env:

```
STRIPE_PRICE_PLUS_MONTHLY     = price_...
STRIPE_PRICE_PLUS_YEARLY      = price_...
STRIPE_PRICE_PREMIUM_MONTHLY  = price_...
STRIPE_PRICE_PREMIUM_YEARLY   = price_...
```

Webhook endpoint:
- Stripe → Developers → Webhooks → Add endpoint
- URL: `https://cpcprofit.sk/api/stripe/webhook`
- Events: `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`
- Skopíruj **Signing secret** do `STRIPE_WEBHOOK_SECRET`

Customer Portal aktivuj v Stripe → Settings → Billing → Customer portal.

## 5. Supabase Auth — Google OAuth

V Supabase Dashboard → Authentication → Providers → **Google**:
- Client ID + Secret z [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  → OAuth 2.0 Client → Web application
- **Authorized redirect URI**: `<SUPABASE_URL>/auth/v1/callback`
- V Google Cloud OAuth consent → Add scope: `email`, `profile`, `openid`

App-side redirect po login: `https://cpcprofit.sk/auth/callback`. Auto-handled.

## 6. Pull env + apply DB schéma

```bash
vercel env pull .env.local                # stiahni env zo všetkých prostredí
pnpm install
pnpm drizzle-kit push                     # vytvor 11 tabuliek + 6 enums
pnpm tsx scripts/seed-vehicles.ts         # 50+ canonical SK modelov
```

## 7. Local smoke test

```bash
pnpm dev
# v inom terminále:
curl -s http://localhost:3000/api/health | jq
# {"status":"ok","checks":{"db":true,"supabase":true,...}}
```

Otvor http://localhost:3000, prejdi:
- [ ] Landing renders
- [ ] /login → Google OAuth flow funguje, redirect na /app/overview
- [ ] /app/ai-listing → form submit streamuje real Claude response (`x-cpcprofit-mode: live`)
- [ ] /app/billing → klikni "Upraviť plán" → Stripe Checkout → test card `4242 4242 4242 4242`
- [ ] Po platbe webhook upsertne `subscriptions` row, /app/billing zobrazí Plus

## 8. Production deploy

```bash
git push origin main
# Vercel auto-buildne preview na každý push
vercel deploy --prod         # alebo Vercel Dashboard → Promote to Production
```

Prvý prod deploy aktivuje Cron jobs (`/api/cron/dispatch-scrape` každých 6h).

## 9. Domain bind

Vercel Dashboard → tvoj projekt → Settings → Domains:
- Pridaj `cpcprofit.sk` + `www.cpcprofit.sk` (redirect na apex)
- Vercel ti dá DNS recordy → nastav v registrátorovi
- HTTPS sa zapne automaticky cez Let's Encrypt

## 10. Post-launch

- Sentry → vytvor projekt + alert rules pre prod
- Vercel Analytics zapni v Dashboard → Analytics
- Stripe → Webhook → over že eventy chodia (Recent deliveries)
- Health-check uptime monitor: `https://cpcprofit.sk/api/health` každých 5 min
- (Voliteľne) Rolling Releases: Vercel Dashboard → Project → Settings → **Rolling Releases** (vyžaduje Pro/Enterprise plán). Pre prvý prod deploy zvoľ napr. 25 % cohort, potom postupne 100 %.

## Rollback

```bash
vercel ls --prod             # zoznam prod deployov
vercel promote <previous-deployment-url>  # rollback na predošlý
```

DB migrácie sú forward-only — pred destruktívnou migráciou zálohuj cez
Supabase Dashboard → Database → Backups.
