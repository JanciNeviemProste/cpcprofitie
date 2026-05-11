import * as cheerio from 'cheerio';
import {
  czkToEur,
  extractCzkFromText,
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
import { detailUrl, parseDetailPage } from './sauto-cz-detail';
import type { ScraperSource } from './source-interface';

const BASE = 'https://www.sauto.cz';

// sauto.cz listing detail URLs: /osobni/detail/<brand>/<model>/<numericId>.
// The card markup wraps an anchor with this href, an <h3> title, and a few
// <p> blocks with year/km/fuel/transmission, price, seller, and location.
const LISTING_URL_RE = /^\/osobni\/detail\/([^/]+)\/([^/]+)\/(\d+)\/?$/;

export function parseListingsPage(html: string): NormalizedListing[] {
  const $ = cheerio.load(html);
  const results: NormalizedListing[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const match = LISTING_URL_RE.exec(href);
    if (!match) return;
    const sourceId = match[3]!;
    if (seen.has(sourceId)) return;
    seen.add(sourceId);

    const url = `${BASE}${href.endsWith('/') ? href : `${href}/`}`;
    const $anchor = $(el);
    const $title = $anchor.find('h3').first();
    const title = ($title.text() ?? $anchor.attr('title') ?? '').trim() || null;
    const cardText = $anchor.text();

    const { makeSlug, modelSlug } = parseMakeModel(title);
    const priceCzk = extractCzkFromText(cardText);
    const priceEur = priceCzk != null ? czkToEur(priceCzk) : extractEurFromText(cardText);
    const year = extractYearFromText(cardText);
    const mileageKm = extractKmFromText(cardText);
    const fuel = parseFuel(extractFuelHintFromText(cardText));
    const transmission = parseTransmission(extractTransmissionHintFromText(cardText));
    const region = prefixRegion(extractCzLocation(cardText), 'CZ');

    results.push({
      source: 'sauto.cz',
      sourceId,
      url,
      makeSlug,
      modelSlug,
      priceEur,
      priceCzk,
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

export const sautoCz: ScraperSource = {
  id: 'sauto.cz',
  baseUrl: BASE,
  pageUrl({ page }) {
    return `${BASE}/inzerce/osobni?strana=${page}`;
  },
  parseListingsPage,
  detailUrl,
  parseDetailPage,
};

// Czech locations on sauto.cz look like "Praha", "Praha-západ", "Brno",
// "Středočeský". Without a dedicated DOM marker we look for a CZ-shaped
// token after the seller name (last token line, before the image link).
const CZ_LOCATION_HINTS = [
  'Praha',
  'Brno',
  'Ostrava',
  'Plzeň',
  'Liberec',
  'Olomouc',
  'Hradec',
  'Pardubice',
  'Středočeský',
  'Jihočeský',
  'Karlovarský',
  'Ústecký',
  'Pardubický',
  'Vysočina',
  'Jihomoravský',
  'Olomoucký',
  'Zlínský',
  'Moravskoslezský',
];

function extractCzLocation(text: string): string | null {
  for (const c of CZ_LOCATION_HINTS) {
    if (text.includes(c)) {
      // Capture "Praha-západ" and similar suffixed variants. Use Unicode
      // letter class so Czech diacritics (á, í, é, ž, š) match.
      const re = new RegExp(`${c}[-\\p{L}\\d]*`, 'u');
      const m = re.exec(text);
      return m?.[0] ?? c;
    }
  }
  return null;
}
