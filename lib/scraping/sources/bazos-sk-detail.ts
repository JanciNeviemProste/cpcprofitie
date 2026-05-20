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

  const bodyType = extractAfterLabel(fullText, 'Karoséria');
  const colorExterior = extractAfterLabel(fullText, 'Farba');
  const vinRaw = extractAfterLabel(fullText, 'VIN');
  const vin = isPlausibleVin(vinRaw) ? vinRaw : null;
  const powerKw = parseFirstInt(extractAfterLabel(fullText, 'Výkon'));
  const engineCcm = parseFirstInt(extractAfterLabel(fullText, 'Objem'));
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
  const $popis = $('.popisdetail').first();
  if ($popis.length > 0) {
    description = $popis.text().trim().slice(0, 4000);
  }

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
  };
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
