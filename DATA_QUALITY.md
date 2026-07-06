# Kvalita dát — stav a roadmapa udržateľnosti

CPCProfit stojí a padá na kvalite scrapovaných dát: DealScore, trhové mediány
a trendy sú len také dôveryhodné, ako sú dáta pod nimi. Tento dokument drží
nameraný stav, čo je hotové, a plán ako kvalitu dlhodobo udržať.

## Ako merať (už existuje)

- **Admin prehľad:** `/app/admin/data-quality` — completeness (% chýbajúcich
  polí per zdroj), outliery, kohort-readiness, pokrytie enrichmentu, DealScore
  health, a **health flag** (🟢/🟡/🔴 Drift?) pre okamžitú detekciu.
- **Endpoint:** `GET /api/admin/data-quality` (admin session alebo
  `Authorization: Bearer $CRON_SECRET`) → JSON, vhodné na skriptovanie.
- Zdroj: `lib/db/queries/data-quality.ts` (read-only agregácie).

## Nameraný baseline (2026-07-06, pred fixom autobazar.sk)

| Zdroj | Aktívne | Cena null | Model null | Región null | Kohort-ready |
|---|---|---|---|---|---|
| autobazar.eu | 50 134 | 8 % | 80 % | 8 % | 20 % |
| autobazar.sk | 9 677 | **100 %** | 13 % | 82 % | 0 % |
| bazos.sk | 8 339 | 32 % | 49 % | 62 % | 2 % |

Zo 68 150 aktívnych inzerátov len 846 kŕmilo DealScore.

## Hotové (nasadené)

1. **Meranie** — data-quality report + admin stránka + endpoint.
2. **Plausibility filtre** (`lib/analytics/quality.ts`) — junk hodnoty (€1,
   9 mil. km) sú vylúčené z kohort, mediánov aj snapshotov.
3. **model_id backfill** (`/api/admin/backfill-model-id`) — bezpečný NULL-only
   fill z `raw_title`.
4. **Fix autobazar.sk parsera** — príčina 100 % null ceny bola drift selektora
   (`closest('article,li,tr,section')` na stránke, ktorá používa `div.item`);
   plus kraj-kódy („NR kraj" → Nitriansky) a fuel z engine-badge. Živý scrape:
   cena/rok/km/región 0 % → 100 %. **Reálny fixture + coverage canary** v teste
   (aby drift znova neprešiel cez CI ako minule).
5. **Drift health flag** — report označí zdroj 🔴, keď cena/model coverage
   spadne — selektorový drift sa chytí o hodiny, nie o mesiace.

## Zostávajúce bottlenecky (evidence-based)

- **autobazar.eu ~41k title-less stubov** — null-model riadky majú aj prázdny
  `raw_title` (staré URL-stub scraper). Riešenie = re-enrichment fronta, nie
  title-backfill.
- **transmission ~86 % null** naprieč zdrojmi — parsuje sa slabo z list-page.
- **region** stále vysoký null na bazos.sk (62 %).

## Roadmapa udržateľnosti (priorita zhora)

### 1. Drift alerting cron (S) — najvyššia páka na udržateľnosť
Ľahký `/api/cron/data-quality-alert` (denne, CRON_SECRET), ktorý zavolá report
a pošle **Sentry warning**, keď je ktorýkoľvek zdroj v stave `drift`. Health
logika už existuje (`assessHealth`); treba len cron obal + Sentry. Efekt:
selektorový drift (ako autobazar.sk) sa ohlási sám, bez manuálnej kontroly.

### 2. Ingest-time validácia (S–M)
Pri `upsertListings` (`lib/scraping/persist.ts`) flagovať/karanténovať riadky
mimo plausibility bounds (reuse `lib/analytics/quality.ts`) — nech junk
nevstúpi do DB, nielen že sa filtruje pri čítaní. Voliteľne DB `CHECK`
constraint ako posledná poistka.

### 3. Re-enrichment fronta pre stuby (M)
Krok vo `weekly-maintenance`, ktorý prioritne re-enrichne title-less/model-less
aktívne inzeráty (najprv tie, čo by kŕmili kohorty). Odomkne autobazar.eu 41k.

### 4. Reálne fixtures pre všetky zdroje + freshness check (S–M)
autobazar.eu a bazos.sk fixtures overiť, či sú reálne (autobazar.sk je už).
Štvrťročná (alebo CI-periodická) kontrola, či živá stránka stále zodpovedá
fixture štruktúre — inak coverage canary.

### 5. Extraction coverage: transmission / fuel / region (M)
- transmission: doťahovať z detail-enrichmentu (`listingOverrides` už dopĺňa
  NULL polia); rozšíriť detail parsery.
- fuel: engine-badge heuristika je v autobazar.sk; preniesť do ostatných.
- region bazos.sk: mapovať mestá → kraj (rozšíriť `sk-regions.ts`).

### 6. Cross-source kanonizácia — meranie (M)
Dedup beží (`lib/dedup/`), ale bez metrík kvality. Pridať do reportu: % listingov
s `canonical_listing_id`, počet VIN-zhôd naprieč zdrojmi. To isté auto na 2
weboch = 1 canonical — dnes to nevieme odmerať.

### 7. CZK→EUR živý kurz (S)
`normalize.ts` `CZK_PER_EUR = 25` je fixný. Nahradiť ECB feedom (cache 24h),
inak CZK inzeráty (autobazar.eu / bazos) majú skreslené EUR ceny.

### 8. Golden dataset / eval (M)
Malá ručne labelovaná vzorka (~50 inzerátov per zdroj) s očakávanou
cenou/rokom/km/modelom. Test/script, ktorý meria presnosť parsera v čase —
regresie v extrakcii sa chytia kvantitatívne, nielen cez null-rate.

## Odhady

| Bod | Effort | Dopad |
|---|---|---|
| 1 Drift alerting | S (½ dňa) | vysoký — samo-detekcia driftu |
| 2 Ingest validácia | S–M | stredný |
| 3 Re-enrichment fronta | M (1–2 dni) | vysoký — 41k inzerátov |
| 4 Fixtures + freshness | S–M | stredný — prevencia |
| 5 Extraction coverage | M | stredný |
| 6 Kanonizácia meranie | M | stredný |
| 7 CZK kurz | S | nízky-stredný |
| 8 Golden eval | M | stredný — dlhodobá istota |

**Odporúčané poradie:** 1 → 4 → 2 → 3 → zvyšok. Body 1 a 4 sú lacná poistka,
ktorá zabráni opakovaniu presne tejto autobazar.sk regresie.
