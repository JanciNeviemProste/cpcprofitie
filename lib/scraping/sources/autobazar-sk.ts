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
import type { ScraperSource } from './source-interface';

const BASE = 'https://www.autobazar.sk';

// autobazar.sk cards are anchors whose href matches /<numericId>/<slug>/.
// The card has no semantic CSS class — we discover it by URL shape, then
// climb to the visual block (usually 1-2 parent elements) to read text
// content (price + year/km/fuel comma-separated).
const LISTING_URL_RE = /^\/(\d{6,})\/[\w-]+\/?$/;

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

    const url = `${BASE}${href.endsWith('/') ? href : `${href}/`}`;
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
    const title = ($anchor.attr('title') ?? $anchor.text() ?? '').trim() || null;
    const cardText = $card.text();

    const { makeSlug, modelSlug } = parseMakeModel(title);
    const priceEur = extractEurFromText(cardText);
    const year = extractYearFromText(cardText);
    const mileageKm = extractKmFromText(cardText);
    const fuel = parseFuel(extractFuelHintFromText(cardText));
    const transmission = parseTransmission(extractTransmissionHintFromText(cardText));
    const region = prefixRegion(extractRegionHint(cardText), 'SK');

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
    });
  });

  return results;
}

export const autobazarSk: ScraperSource = {
  id: 'autobazar.sk',
  baseUrl: BASE,
  pageUrl({ page }) {
    return `${BASE}/osobne-auta/?page=${page}`;
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

function extractRegionHint(text: string): string | null {
  for (const r of SK_REGIONS) {
    if (text.includes(r)) return r;
  }
  return null;
}
