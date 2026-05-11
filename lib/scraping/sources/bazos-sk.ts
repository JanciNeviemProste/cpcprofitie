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
import type { ScraperSource } from './source-interface';

const BASE = 'https://auto.bazos.sk';

// Bazoš listing detail URLs: /inzerat/<numericId>/<slug>.php — anchor as
// card detector, parent block holds the description text (year/km/fuel hints).
const LISTING_URL_RE = /^\/inzerat\/(\d+)\/[^?#]*\.php$/;

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

    const url = `${BASE}${href}`;
    const $anchor = $(el);
    // Bazoš structures vary — climb 2-3 levels to grab description + price.
    const $card =
      $anchor.closest('table').length > 0
        ? $anchor.closest('tr, table')
        : $anchor.parent().parent().length
          ? $anchor.parent().parent()
          : $anchor.parent();
    const title = $anchor.text().trim() || null;
    const cardText = $card.text();

    const { makeSlug, modelSlug } = parseMakeModel(title);
    const priceEur = extractEurFromText(cardText);
    const year = extractYearFromText(cardText);
    const mileageKm = extractKmFromText(cardText);
    const fuel = parseFuel(extractFuelHintFromText(cardText));
    const transmission = parseTransmission(extractTransmissionHintFromText(cardText));
    const region = prefixRegion(extractLocationHint(cardText), 'SK');

    results.push({
      source: 'bazos.sk',
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

export const bazosSk: ScraperSource = {
  id: 'bazos.sk',
  baseUrl: BASE,
  pageUrl({ page }) {
    // Bazoš pagination is offset-based: /0/, /20/, /40/, ... 20 per page.
    const offset = (page - 1) * 20;
    return `${BASE}/${offset === 0 ? '' : `${offset}/`}`;
  },
  parseListingsPage,
};

// Bazoš location is a city name + postal code, e.g. "Žiar nad Hronom 965 01".
// We capture the leading word(s) before the postal code as a coarse region.
function extractLocationHint(text: string): string | null {
  const m = /([A-ZÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ][\p{L}\s-]{1,40})\s+\d{3}\s?\d{2}/u.exec(text);
  return m?.[1]?.trim() ?? null;
}
