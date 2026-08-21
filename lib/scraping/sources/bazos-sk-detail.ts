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

/**
 * The town the car is in.
 *
 * Read from `<meta name="description">` rather than the description block. The
 * `.popisdetail` scoping above exists because page-wide text carries a
 * sidebar of OTHER listings, and it does its job for year and mileage — but
 * bazoš simply does not put the locality in that block. Measured on live
 * pages: the meta tag sits at byte ~170 and `.popisdetail` starts past byte
 * 16 000, which is why the region was populated on 0.5% of the source.
 *
 * A `<meta>` in `<head>` is per-document by construction, so the sidebar
 * cannot reach it — this is strictly safer than the block, not a relaxation of
 * the guard.
 *
 * Deliberately NOT extractAfterLabel: that regex terminates on a comma,
 * semicolon or newline but not a full stop, so on the real string
 * "…Lokalita: Detva. Popis: Preedám Mercedes…" it returns 79 characters of
 * advert prose. That is worse than the NULL it replaces — it fits varchar(64)
 * only after truncation and would be stored as a place name.
 */
// Ends on a full stop as well as the comma/semicolon/newline/double-space
// that extractAfterLabel stops on. The meta tag runs the labels together as
// "Lokalita: Detva. Popis: …", so without the full stop the value swallows
// the whole advert; the body-text fallback has no punctuation after the town
// at all, so the other terminators still have to be there.
const LOCALITY_RE = /Lokalita:[ \t]*([^\n.,;]{1,48}?)[ \t]*(?:[\n.,;]|[ \t]{2,}|$)/i;

export function extractLocality(
  $: cheerio.CheerioAPI,
  fallbackText: string,
): string | null {
  const meta = $('meta[name="description"]').attr('content') ?? null;
  for (const source of [meta, fallbackText]) {
    if (!source) continue;
    const m = LOCALITY_RE.exec(source);
    const value = m?.[1]?.trim();
    // Sellers write prose; a "locality" longer than any Slovak place name is
    // the parser having walked off the end of the label, not a place.
    if (value && value.length > 0 && value.length <= 48) return value;
  }
  return null;
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

  // Bounded: sellers write prose, and "Karoséria aj interiér sú vzhľadom na vek
  // vozidla vo veľmi peknom stave" makes the label lookup return a whole
  // sentence. That is 73 characters into a varchar(32) — the insert failed and
  // took the entire listing's detail row with it.
  const bodyType = boundedLabel(labelText, 'Karoséria', 32);
  const colorExterior = boundedLabel(labelText, 'Farba', 64);
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
  const locality = extractLocality($, labelText);
  const region = prefixRegion(locality, 'SK');

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
  if (locality != null) listingOverrides.locality = locality;

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
// Order is significance, not convenience: a registration date beats "MODEL",
// which on the Ford sample said 2020 while the car was first registered 11/2019.
// 'r.v' is listed without its dot because sellers write it every way there is —
// "r.v.", "r.v:", "r.v 2022/4", even "r.v11/2022" with nothing between at all.
// Year labels are patterns, not literals, because "r.v." is written every way
// a keyboard allows: "r.v.", "r. v.", "rv.", "rv", and "r.v11/2022" with
// nothing after it at all. Matching them as fixed strings recovered 18% of the
// missing years; the descriptions carry one in roughly half.
//
// The registration forms need a leading word boundary — without one the "rv"
// pattern matches inside ordinary words ("servisná"), and a label that matches
// anywhere will read whatever number happens to follow it.
//
// Order is significance: a registration date beats "MODEL", which on the Ford
// sample said 2020 while the car was first registered 11/2019.
const YEAR_LABEL_PATTERNS = [
  'Rok výroby',
  '\\bro[cč]n[ií]k',
  '\\br\\.?\\s*v\\.?',
  'Prvá evidencia',
  '1\\. evidencia',
  'registr[aá]ci[ae]',
  '\\bRok',
  '\\bMODEL',
];

function rawTitleForYear($: cheerio.CheerioAPI): string | null {
  return $('h1').first().text().trim() || null;
}

/**
 * Year from text that is already in the database rather than freshly fetched
 * HTML. Same rules as the live path, so a backfill and a scrape agree — the
 * only difference is the input, which lets listing_details.description be
 * re-read without touching the network.
 */
export function extractYearFromStoredText(
  description: string | null,
  title: string | null,
): number | null {
  return extractYear(description ?? '', title);
}

function extractYear(labelText: string, title: string | null): number | null {
  for (const pattern of YEAR_LABEL_PATTERNS) {
    const y = parseYearFromLabel(extractAfterPattern(labelText, pattern));
    if (y != null) return y;
  }
  // Titles often carry it: "Citroen C3 1.5 BlueHDi 75 kw - 2023 - odpočet DPH".
  return extractYearFromText(title);
}

// Labels as patterns, for the same reason as YEAR_LABEL_PATTERNS: sellers write
// the odometer every way there is. "Najazdené: 199 653", "KM:130904",
// "Km 176000", "✅️km: 112000". A bare "km" label needs a word boundary or it
// matches inside ordinary words.
const KM_LABEL_PATTERNS = [
  'Najazden[eé]ho',
  'Najazden[éeé]',
  'Najazden[ýy]ch',
  'Stav km',
  'Tachometer',
  'Najazd',
  '\\bkm',
  '\\bKM',
];

function extractKm(labelText: string): number | null {
  for (const pattern of KM_LABEL_PATTERNS) {
    const km = parseKmValue(extractAfterPattern(labelText, pattern));
    if (km != null) return km;
  }

  // Unlabelled odometers are common ("✅ 199 653 km").
  //
  // Every match is tried, not just the first, and each is trimmed from the
  // left before giving up: "MOD. ROK 2015 182 700 KM" captures the year into
  // the digit run and reads as 2 015 182 700, which is out of range. Dropping
  // leading groups until the remainder is plausible recovers 182 700 — and the
  // range check is what keeps that from being a licence to invent.
  const re = /(\d[\d\s.,]{2,})\s*km\b/gi;
  for (const m of labelText.matchAll(re)) {
    const groups = m[1]!.trim().split(/[\s.,]+/).filter(Boolean);
    for (let i = 0; i < groups.length; i++) {
      const km = parseKmValue(groups.slice(i).join(''));
      if (km != null) return km;
    }
  }

  // The thousands shorthand last, so a plainly written odometer always wins.
  // The existing fixture has both: "203.336KM" is the car's mileage and
  // "188tis. KM" is a service note further down the same description. Reading
  // this first would take the service note.
  //
  // "km" must follow, or "cena 15 tis €" reads as an odometer.
  const tis = /(\d{1,4})\s*tis[a-z]*\.?\s*km/i.exec(labelText);
  if (tis) {
    const n = Number(tis[1]) * 1000;
    if (n >= 1000 && n <= 2_000_000) return n;
  }

  return null;
}

/**
 * Mileage from text already in the database rather than freshly fetched HTML.
 * Same rules as the live path, so a backfill and a scrape agree.
 */
export function extractKmFromStoredText(description: string | null): number | null {
  return extractKm(description ?? '');
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

/**
 * "Rok výroby: 10/2018" → 2018, "model 2020" → 2020, and "r.v.: 12/22" → 2022.
 *
 * The two-digit form is the common one on Bazoš and was being dropped
 * entirely — 4 779 cars carried a year nobody read. It has to be matched
 * before the four-digit branch, because a value like "12/22, 1968cm³" also
 * contains a plausible-looking four-digit number: engine displacement. 1968,
 * 1984 and 2000 all pass a naive year check, so a mis-order here would not
 * fail loudly, it would quietly file cars under the wrong decade.
 */
function parseYearFromLabel(s: string | null): number | null {
  if (!s) return null;
  const max = new Date().getFullYear() + 1;
  const ok = (y: number) => (y >= 1980 && y <= max ? y : null);

  // Every branch below is anchored to the start of the value, and they run
  // most-specific first. That ordering is the whole correctness argument: a
  // Bazoš value reads "12/22, 1968cm³, 110kW", so the generic
  // four-digit branch would happily return the engine displacement. 1968, 1984
  // and 2000 all pass a plausible-year check, so getting this wrong would not
  // fail loudly — it would quietly file cars under the wrong decade.

  // D.M.YYYY — dealers who paste an exact registration date ("18.1.2023").
  const dmy = new RegExp('^\\s*(\\d{1,2})[./](\\d{1,2})[./](\\d{4})').exec(s);
  if (dmy && Number(dmy[2]) >= 1 && Number(dmy[2]) <= 12) return ok(Number(dmy[3]));

  // YYYY/M — the same pair as below with the halves swapped ("r.v 2022/4").
  // Distinguishable from MM/YYYY only by width, hence two branches.
  const ym = new RegExp('^\\s*(\\d{4})\\s*/\\s*(\\d{1,2})(?!\\d)').exec(s);
  if (ym && Number(ym[2]) >= 1 && Number(ym[2]) <= 12) return ok(Number(ym[1]));

  // MM/YY — the most common form on Bazoš, and the one that was dropped
  // entirely until now.
  const short = new RegExp('^\\s*(\\d{1,2})\\s*/\\s*(\\d{2})(?!\\d)').exec(s);
  if (short) {
    const month = Number(short[1]);
    const yy = Number(short[2]);
    if (month >= 1 && month <= 12) {
      // A two-digit year at or just past today reads as this century.
      return ok(yy <= max % 100 ? 2000 + yy : 1900 + yy);
    }
  }

  // MM/YYYY or a bare year. Deliberately last and deliberately unanchored:
  // it is the catch-all for "r.v.: 10/2018" and "model 2020", and by the time
  // it runs every shape that could be confused with it has been ruled out.
  const m = new RegExp('(?:\\d{1,2}\\s*/\\s*)?(\\d{4})').exec(s);
  return m ? ok(Number(m[1])) : null;
}

/**
 * A label lookup bounded by the column it will be written to. A value longer
 * than the column is prose that happened to follow the label, not a value —
 * storing it truncated ("aj interiér sú vzhľadom na") would be worse than
 * storing nothing, and storing it whole fails the insert.
 */
function boundedLabel(text: string, label: string, maxLen: number): string | null {
  const value = extractAfterLabel(text, label);
  return value !== null && value.length <= maxLen ? value : null;
}

function extractAfterLabel(text: string, label: string): string | null {
  return extractAfterPattern(text, escapeRe(label));
}

/** As above, but the label is already a regex — see YEAR_LABEL_PATTERNS. */
function extractAfterPattern(text: string, labelPattern: string): string | null {
  // The gap between a label and its value is whatever the seller typed:
  // "r.v.: 12/22", "r.v 2022/4", "Rok výroby:18.1.2023", or nothing at all
  // in "r.v11/2022". Consuming all of it matters because parseYearFromLabel
  // anchors its patterns to the start of the value — a leading ".:" left
  // behind would push every date shape out of reach and fall through to the
  // catch-all, which is exactly the branch that reads engine displacement.
  const re = new RegExp(`${labelPattern}[\\s:.-]*([^\\n,;]+?)(?:\\s{2,}|\\n|,|;|$)`, 'i');
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
