import * as cheerio from 'cheerio';
import {
  extractEurFromText,
  extractFuelHintFromText,
  extractKmFromText,
  extractTransmissionHintFromText,
  extractYearFromText,
  parseFuel,
  parseMakeModel,
  parseTransmission,
  prefixRegion,
} from '../normalize';
import type { NormalizedListing } from '../types';
import { detailUrl, parseDetailPage } from './autobazar-sk-detail';
import type { CheerioNode, ScraperSource } from './source-interface';

const BASE = 'https://www.autobazar.sk';

// autobazar.sk cards are anchors whose href matches /<numericId>/<slug>/.
// Listings can appear as relative (/27891055/audi-sq7/) or absolute
// (https://www.autobazar.sk/27891055/audi-sq7/) — accept both.
const LISTING_URL_RE =
  /^(?:https?:\/\/(?:www\.)?autobazar\.sk)?\/(\d{6,})\/([\w-]+)\/?$/;

// "audi-a4-avant-40-2-0-tdi-quattro-s-tronic-140kw-190hp-a7"
// → "Audi A4 Avant 40 2 0 TDI Quattro S Tronic 140kw 190hp A7"
// We capitalize the first letter of each token and uppercase short alpha
// abbreviations (TDI, KW, HP, AT etc.) to look like real titles.
function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => {
      // pure digits → leave as-is
      if (/^\d+$/.test(part)) return part;
      // short all-letters tokens (2-4 chars) — uppercase common car abbreviations
      const upper = part.toUpperCase();
      if (part.length <= 4 && /^[a-z]+$/.test(part)) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

export function parseListingsPage(html: string): NormalizedListing[] {
  const $ = cheerio.load(html);
  const results: NormalizedListing[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const match = LISTING_URL_RE.exec(href);
    if (!match) return;
    const sourceId = match[1]!;
    if (seen.has(sourceId)) return;
    seen.add(sourceId);

    // href may be absolute or relative — normalise to canonical absolute URL.
    const path = href.replace(/^https?:\/\/(?:www\.)?autobazar\.sk/, '');
    const url = `${BASE}${path.endsWith('/') ? path : `${path}/`}`;
    // Climb to a reasonable card-sized parent so we capture surrounding
    // text (price, meta line). 2 levels works for current layout.
    const $anchor = $(el);
    // Scope cardText to the card wrapper so we don't bleed price/year text
    // from neighbouring cards. autobazar.sk renders each result as
    // `<div class="item">…<div class="item-teaser">`; earlier this only
    // looked for article/li/tr/section (absent on the site), fell back to the
    // shallow parent, and so captured no price/year/km/region — hence the
    // 100% null price the data-quality report surfaced. `.item` is the whole
    // card; keep the semantic tags + parent as fallbacks for layout changes.
    const $card = (() => {
      const $c = $anchor.closest('.item, .item-teaser, article, li, tr, section');
      return $c.length > 0 ? $c : $anchor.parent();
    })();
    // Autobazar.sk doesn't put titles on anchors or in anchor text — they live
    // in `<img alt="Mercedes-Benz EQA 350 4Matic, 08-2024, …">` inside the card.
    // Fall back through: anchor title → anchor text → first non-empty img alt.
    const titleFromAttr = ($anchor.attr('title') ?? '').trim();
    const titleFromText = ($anchor.text() ?? '').trim();
    const titleFromImg = $card.find('img[alt]').first().attr('alt')?.trim() ?? '';
    // Last resort: decode the URL slug — every listing has it, so this guarantees
    // we get *some* title even on cards without thumbnails / alt text.
    const titleFromSlug = match[2] ? slugToTitle(match[2]) : '';
    const title = titleFromAttr || titleFromText || titleFromImg || titleFromSlug || null;
    const cardText = $card.text();
    // The card layout is: title · meta line (year · gearbox · km · kraj) ·
    // price · equipment list. The equipment list ("elektrické okná",
    // "manuálna klimatizácia") sits AFTER the "€" and would false-positive
    // fuel/transmission word-hints, so scan only the pre-price meta portion
    // for everything except the price itself.
    const metaText = cardText.split('€')[0] ?? cardText;

    const { makeSlug, modelSlug } = parseMakeModel(title);
    const priceEur = extractEurFromText(cardText);
    const year = extractYearFromText(metaText);
    const mileageKm = extractKmFromText(metaText);
    // Fuel: the engine badge in the title ("2.0 TDI") is the most reliable
    // signal; fall back to a fuel word in the meta line (not equipment).
    const fuel =
      fuelFromEngineCode(title ?? '') ?? parseFuel(extractFuelHintFromText(metaText));
    const transmission = parseTransmission(extractTransmissionHintFromText(metaText));
    const region = prefixRegion(extractRegionHint(metaText), 'SK');

    // Engagement signals (best-effort: list page rarely exposes these; detail
    // enrichment fills in the rest). isFeatured fires on the VIP/TOP card
    // class autobazar.sk applies to paid promotions.
    const isFeatured =
      $card.is('.ab-card-vip, .vip, .top, [class*="vip" i], [class*="top-promo" i]') ||
      $card.find('.ab-card-vip, .vip-badge, [class*="vip" i]').length > 0 ||
      /\bVIP\b/.test(cardText)
        ? true
        : undefined;
    const viewCount = parseAbSkViewCount($, $card);
    const sellerPhone = parseAbSkPhone(cardText);

    results.push({
      source: 'autobazar.sk',
      sourceId,
      url,
      makeSlug,
      modelSlug,
      priceEur,
      year,
      mileageKm,
      fuel,
      transmission,
      region,
      country: 'SK',
      rawTitle: title,
      rawPayload: { capturedAt: new Date().toISOString() },
      viewCount,
      isFeatured,
      sellerPhone,
    });
  });

  return results;
}

// autobazar.sk client-side renders the main /inzeraty/ listing — server HTML
// only contains the featured panel (~20 listings) and ignores ?page=N. The
// per-category subdomains DO server-render paginated pages of 20 unique
// listings each.
//
// The pagination parameter is `?p[page]=N` — an array-style query key. Plain
// `?page=`, `/2/` and `?strana=` all return page one again, which is how this
// source sat at ~700 listings while the site holds roughly thirty times that.
// Nothing errored: repeated pages deduplicated on upsert and the run reported
// success with added: 0.
//
// This used to walk a fixed list of 35 brand subdomains, 25 pages each. That
// fixed the pagination bug but left a worse one behind: a brand outside the
// list was not merely under-covered, it was INVISIBLE — no number of cycles
// would ever surface a Cupra, a DS, a Polestar or a Jaecoo. It also burned
// fetches, because a brand with 12 pages of stock repeated its last page for
// the remaining 13 slots.
//
// osobne-auta.autobazar.sk is the same markup without the brand restriction.
// Measured 2026-08-21: pages 1, 2, 50, 200, 500, 900, 950 and 1000 each return
// 20 listings with no overlap between them (120 distinct ids across 6 sampled
// pages), and the walk ends sharply — 1001 serves, 1002 is a 404.
//
// So the space is 1 001 pages ≈ 20 020 listings. Note that this is a CAP, not
// necessarily the size of the catalogue: if the site ever holds more than
// 20 020 cars, whatever sorts last becomes unreachable here and the fix is to
// walk narrower slices (by brand, or by bodywork) rather than to raise this
// number. The freshness and completeness watchdogs are what would show it.
const MAX_PAGE = 1001;

export const autobazarSk: ScraperSource = {
  id: 'autobazar.sk',
  baseUrl: BASE,
  pageUrl({ page }) {
    const p = Math.max(1, page);
    // Page one is the bare subdomain; every later page takes the array-style
    // query key. Same shape the brand subdomains used.
    return p === 1
      ? 'https://osobne-auta.autobazar.sk/'
      : `https://osobne-auta.autobazar.sk/?p[page]=${p}`;
  },
  // A linear list, so a 404 really is the end — unlike the old brand walk,
  // where a short brand produced one mid-sequence. Kept close to the measured
  // ceiling on purpose: set it far above and every cycle burns the difference
  // in pointless 404s before the walker agrees the source is exhausted.
  maxPage: MAX_PAGE,
  parseListingsPage,
  detailUrl,
  parseDetailPage,
};

// Region on autobazar.sk cards is rendered as a kraj-capital plate code plus
// "kraj" — e.g. "NR kraj", "BA kraj". Map the 8 codes to the full kraj name so
// downstream SK_KRAJE ILIKE matching (lib/data/sk-regions.ts) resolves it.
const SK_REGIONS = [
  'Bratislavský',
  'Trnavský',
  'Trenčiansky',
  'Nitriansky',
  'Žilinský',
  'Banskobystrický',
  'Prešovský',
  'Košický',
];

const KRAJ_CODE_TO_NAME: Record<string, string> = {
  BA: 'Bratislavský',
  TT: 'Trnavský',
  TN: 'Trenčiansky',
  NR: 'Nitriansky',
  ZA: 'Žilinský',
  BB: 'Banskobystrický',
  PO: 'Prešovský',
  KE: 'Košický',
};

const KRAJ_CODE_RE = /\b([A-ZŽ]{2})\s+kraj\b/;

// Engine-badge → fuel. Conservative: only well-known diesel/petrol markers.
// TDI/CDI/HDi/dCi/CRDi/BlueTEC = diesel; TSI/TFSI/T-GDI/MPI = petrol.
const DIESEL_BADGE_RE = /\b(tdi|cdi|hdi|dci|crdi|bluetec|d-4d|dtr|jtd)\b/i;
const PETROL_BADGE_RE = /\b(tsi|tfsi|t-gdi|tgdi|mpi|vti|thp|fsi)\b/i;

function fuelFromEngineCode(text: string): 'diesel' | 'gasoline' | null {
  if (DIESEL_BADGE_RE.test(text)) return 'diesel';
  if (PETROL_BADGE_RE.test(text)) return 'gasoline';
  return null;
}

// View counter is occasionally rendered as "Zobrazení: 123" or in an element
// with view-related class. Best-effort — undefined if nothing matches.
function parseAbSkViewCount(
  $: cheerio.CheerioAPI,
  $card: cheerio.Cheerio<CheerioNode>,
): number | undefined {
  const candidates = $card.find('[class*="view" i], [class*="zobrazen" i]');
  let result: number | undefined;
  candidates.each((_, el) => {
    const t = $(el).text().trim();
    const m = /(\d[\d\s]{0,8})/.exec(t);
    if (!m) return;
    const n = Number(m[1]!.replace(/\s/g, ''));
    if (Number.isFinite(n) && n >= 0 && n < 10_000_000) {
      result = n;
      return false;
    }
  });
  if (result !== undefined) return result;
  const txtMatch = /(?:zobrazen[íi]|views?)[\s:]+(\d[\d\s]{0,8})/i.exec($card.text());
  if (txtMatch) {
    const n = Number(txtMatch[1]!.replace(/\s/g, ''));
    if (Number.isFinite(n) && n >= 0 && n < 10_000_000) return n;
  }
  return undefined;
}

const AB_SK_PHONE_RE =
  /(?:\+421\s?\d{3}\s?\d{3}\s?\d{3}|\b0\d{2,3}\s?\d{3}\s?\d{3,4}\b)/;

function parseAbSkPhone(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const m = AB_SK_PHONE_RE.exec(text);
  if (!m) return undefined;
  return m[0].replace(/\s+/g, ' ').trim().slice(0, 32);
}

function extractRegionHint(text: string): string | null {
  // Preferred: "NR kraj" → Nitriansky (the live card format).
  const code = KRAJ_CODE_RE.exec(text);
  if (code && KRAJ_CODE_TO_NAME[code[1]!]) return KRAJ_CODE_TO_NAME[code[1]!]!;
  // Fallback: a full kraj name spelled out (older layout / detail pages).
  for (const r of SK_REGIONS) {
    if (text.includes(r)) return r;
  }
  return null;
}
