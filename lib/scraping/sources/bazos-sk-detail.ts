// Detail-page parser for auto.bazos.sk. Detail URLs are exactly the listing
// URL we already captured (/inzerat/{id}/{slug}.php), so we re-use it.
//
// The detail page has a stable label/value structure inside the description
// block, e.g.:
//
//   Rok výroby: 10/2018
//   Najazdené: 139 730 km
//   Karoséria: SUV / Off-road
//   Palivo: Diesel
//   Prevodovka: Automatická (8 st.)
//   VIN: WBA61DP0409J11308
//   Lokalita: Levice
//
// Photos are served from bazos.sk/img/… as JPGs. The detail page either
// embeds them inline as <img class="obrazek"> or links them under
// <a href="...img/.../<id>.jpg">.

import * as cheerio from 'cheerio';
import { PRICE_MAX, PRICE_MIN } from '@/lib/analytics/quality';
import {
  extractEurFromText,
  extractFuelHintFromText,
  extractYearFromText,
  extractTransmissionHintFromText,
  parseFuel,
  parseMakeModel,
  parseTransmission,
  prefixRegion,
} from '../normalize';
import type { NormalizedDetail, NormalizedListing, SellerType } from '../types';

export function detailUrl(listing: NormalizedListing): string {
  return listing.url;
}

export function parseDetailPage(html: string, listing: NormalizedListing): NormalizedDetail {
  const $ = cheerio.load(html);

  // Photos: collect every <img> whose src points at the bazos image CDN
  // for THIS listing id. Bazoš re-uses thumbnails of related listings on
  // the same page so we filter to ones whose path contains the source id.
  const photos: string[] = [];
  const seen = new Set<string>();
  const idMatch = listing.sourceId;
  $('img[src*="bazos.sk/img/"]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    if (!src.includes(idMatch)) return;
    // Strip cache-bust query so we de-dupe re-orderings of the same file.
    const cleaned = src.split('?')[0]!;
    if (seen.has(cleaned)) return;
    seen.add(cleaned);
    photos.push(cleaned);
  });

  const fullText = $('body').text();

  // Bazoš renders a sidebar of related listings, so page-wide text carries
  // OTHER cars' labels — the price parser below already guards against exactly
  // that. Verified live: a Toyota whose own description says "r.v.: 01/2018"
  // has a neighbour's "Rok výroby: 7/2021" elsewhere in the body, so a
  // body-wide lookup silently wrote 2021 onto that car. Scope every label to
  // this listing's own description block instead.
  const $popis = $('.popisdetail').first();
  const popisText = $popis.length > 0 ? $popis.text() : '';
  const labelText = popisText.trim().length > 0 ? popisText : fullText;

  const bodyType = extractAfterLabel(labelText, 'Karoséria');
  const colorExterior = extractAfterLabel(labelText, 'Farba');
  const vinRaw = extractAfterLabel(labelText, 'VIN');
  const vin = isPlausibleVin(vinRaw) ? vinRaw : null;
  const powerKw = parseFirstInt(extractAfterLabel(labelText, 'Výkon'));
  const engineCcm = parseFirstInt(extractAfterLabel(labelText, 'Objem'));
  // Bazoš mostly doesn't expose seller in a structured way — heuristic only.
  const sellerName: string | null = null;
  const sellerType: SellerType | null = /firma|s\.r\.o|spol\.\s*s\s*r\.\s*o\.|autobazar/i.test(
    fullText,
  )
    ? 'dealer'
    : /S[uú]kromn[yý]/i.test(fullText)
      ? 'private'
      : null;

  // Equipment: bullet list rarely structured. Skip for now.
  const equipment: string[] = [];

  // Description: prefer the "popisdetail" container if present, else first
  // long <div> on the page.
  let description: string | null = null;
  if ($popis.length > 0) {
    description = $popis.text().trim().slice(0, 4000);
  }

  // Detail page has more reliable meta than the list card. Extract overrides
  // so persistDetails can patch any NULL year/km/region/fuel on the listing.
  const year = extractYear(labelText, rawTitleForYear($));
  const mileageKm = extractKm(labelText);
  const fuelHint = extractAfterLabel(labelText, 'Palivo');
  const fuel = parseFuel(extractFuelHintFromText(fuelHint ?? ''));
  const transHint = extractAfterLabel(labelText, 'Prevodovka');
  const transmission = parseTransmission(extractTransmissionHintFromText(transHint ?? ''));
  const locRaw = extractAfterLabel(labelText, 'Lokalita');
  const region = prefixRegion(locRaw, 'SK');

  // Price: anchor to the listing's own `.inzeratycena` element — NEVER a bare
  // "N €" span from the page. Bazoš detail pages render a sidebar of related
  // listings whose prices are also bare € spans; grabbing the first one would
  // write a neighbour's price as this car's. `.inzeratycena` is the same class
  // the list parser anchors on, so backfilled prices match a list scrape.
  // This drains the ~8k legacy price-null stubs (scraped before the list price
  // parser existed) the same way identity drains the model-null ones.
  const priceRaw = extractEurFromText($('.inzeratycena').first().text());
  const priceEur =
    priceRaw != null && priceRaw >= PRICE_MIN && priceRaw <= PRICE_MAX ? priceRaw : null;

  const listingOverrides: NormalizedDetail['listingOverrides'] = {};
  if (priceEur != null) listingOverrides.priceEur = priceEur;
  if (year != null) listingOverrides.year = year;
  if (mileageKm != null && mileageKm > 0) listingOverrides.mileageKm = mileageKm;
  if (fuel != null) listingOverrides.fuel = fuel;
  if (transmission != null) listingOverrides.transmission = transmission;
  if (region != null) listingOverrides.region = region;

  // Identity backfill for title-less/model-less legacy stubs. The detail page
  // carries the full title in <h1> (verified live: "Ford Kuga 1.5 Ecoboost
  // 2020 …"); .nadpisdetail is a fallback. Parse it with the SAME parseMakeModel
  // the list scraper uses, so a backfilled model_id lands on the exact
  // vehicle_models row a list scrape would have produced.
  const rawTitle =
    $('h1').first().text().trim() || $('.nadpisdetail').first().text().trim() || null;
  const { makeSlug, modelSlug } = parseMakeModel(rawTitle);
  const identity =
    makeSlug || modelSlug || rawTitle ? { makeSlug, modelSlug, rawTitle } : undefined;

  return {
    source: listing.source,
    sourceId: listing.sourceId,
    photos,
    description,
    vin,
    bodyType,
    colorExterior,
    colorInterior: null,
    powerKw,
    engineCcm,
    sellerType,
    sellerName,
    equipment,
    identity,
    listingOverrides: Object.keys(listingOverrides).length > 0 ? listingOverrides : undefined,
  };
}

// Only a minority of ads use Bazoš's own "Rok výroby:" field. Dealers write
// their own header instead — "r.v.: 01/2018", "Prvá evidencia 11/2019",
// "MODEL 2020" — which is why a single-label lookup found a year on roughly one
// listing in eight. Registration wins over MODEL: the Ford sample carries both
// "MODEL 2020" and "Prvá evidencia 11/2019", and 2019 is the real one.
const YEAR_LABELS = ['Rok výroby', 'r.v.', 'Prvá evidencia', '1. evidencia', 'Rok', 'MODEL'];

function rawTitleForYear($: cheerio.CheerioAPI): string | null {
  return $('h1').first().text().trim() || null;
}

function extractYear(labelText: string, title: string | null): number | null {
  for (const label of YEAR_LABELS) {
    const y = parseYearFromLabel(extractAfterLabel(labelText, label));
    if (y != null) return y;
  }
  // Titles often carry it: "Citroen C3 1.5 BlueHDi 75 kw - 2023 - odpočet DPH".
  return extractYearFromText(title);
}

const KM_LABELS = ['Najazdené', 'Najazdených', 'Stav km', 'Tachometer', 'Najazd'];

function extractKm(labelText: string): number | null {
  for (const label of KM_LABELS) {
    const km = parseKmValue(extractAfterLabel(labelText, label));
    if (km != null) return km;
  }
  // Unlabelled odometers are common ("✅ 199 653 km"). Only accept a figure
  // large enough to be one: this rules out "5.2 lit. /100 km" and the
  // "188tis. KM" style service notes, which parse below the floor.
  const m = /(\d[\d\s.,]{2,})\s*km\b/i.exec(labelText);
  return m ? parseKmValue(m[1]!) : null;
}

/** Separators in an odometer are thousands marks, never decimals —
 *  "203.336KM", "199 653 km" and "203,336" are all 203336 / 199653. */
function parseKmValue(text: string | null): number | null {
  if (!text) return null;
  const m = /(\d[\d\s.,]*)/.exec(text);
  if (!m) return null;
  const n = Number(m[1]!.replace(/[\s.,]/g, ''));
  return Number.isFinite(n) && n >= 1000 && n <= 2_000_000 ? n : null;
}

// "Rok výroby: 10/2018" → 2018. "Rok výroby: model 2020" → 2020.
function parseYearFromLabel(s: string | null): number | null {
  if (!s) return null;
  const m = /(?:\d{1,2}\s*\/\s*)?(\d{4})/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1980 && n <= new Date().getFullYear() + 1 ? n : null;
}

function extractAfterLabel(text: string, label: string): string | null {
  // Match "Label: value" allowing optional whitespace + . / , ; line breaks.
  const re = new RegExp(`${escapeRe(label)}\\s*[:\\-]?\\s*([^\\n,;]+?)(?:\\s{2,}|\\n|,|;|$)`, 'i');
  const m = re.exec(text);
  return m?.[1]?.trim() ?? null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseFirstInt(text: string | null): number | null {
  if (!text) return null;
  const m = /(\d[\d\s]*)/.exec(text);
  if (!m) return null;
  const n = Number(m[1]!.replace(/\s/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isPlausibleVin(s: string | null): boolean {
  if (!s) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(s.trim().toUpperCase());
}
