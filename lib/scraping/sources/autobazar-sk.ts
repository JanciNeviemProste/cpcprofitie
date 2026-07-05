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
    // Scope cardText to the nearest article/li/tr/section wrapper so we don't
    // bleed price/year text from neighbouring cards. Fallback to the direct
    // parent when no semantic wrapper exists.
    const $card =
      $anchor.closest('article, li, tr, section').length > 0
        ? $anchor.closest('article, li, tr, section')
        : $anchor.parent();
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

    const { makeSlug, modelSlug } = parseMakeModel(title);
    const priceEur = extractEurFromText(cardText);
    const year = extractYearFromText(cardText);
    const mileageKm = extractKmFromText(cardText);
    const fuel = parseFuel(extractFuelHintFromText(cardText));
    const transmission = parseTransmission(extractTransmissionHintFromText(cardText));
    const region = prefixRegion(extractRegionHint(cardText), 'SK');

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
// only contains the featured panel (~20 listings) and ignores ?page=N. Brand
// subdomains (e.g. audi.autobazar.sk) DO server-render per-brand pages with
// 20 unique listings each. We iterate top brands instead of paginated index.
const TOP_BRANDS = [
  'audi',
  'bmw',
  'skoda',
  'volkswagen',
  'mercedes',
  'ford',
  'kia',
  'hyundai',
  'opel',
  'peugeot',
  'renault',
  'toyota',
  'volvo',
  'mazda',
  'nissan',
  'fiat',
  'citroen',
  'seat',
  'honda',
  'suzuki',
  'dacia',
  'land-rover',
  'mini',
  'jeep',
  'mitsubishi',
  'jaguar',
  'alfa-romeo',
  'lexus',
  'porsche',
  'smart',
  'tesla',
  'chevrolet',
  'chrysler',
  'dodge',
  'subaru',
];

export const autobazarSk: ScraperSource = {
  id: 'autobazar.sk',
  baseUrl: BASE,
  pageUrl({ page }) {
    const brand = TOP_BRANDS[(page - 1) % TOP_BRANDS.length] ?? 'audi';
    return `https://${brand}.autobazar.sk/`;
  },
  parseListingsPage,
  detailUrl,
  parseDetailPage,
};

// Best-effort region hint — Slovak `kraj` names typically appear in the card
// footer. We do not crash if absent.
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
  for (const r of SK_REGIONS) {
    if (text.includes(r)) return r;
  }
  return null;
}
