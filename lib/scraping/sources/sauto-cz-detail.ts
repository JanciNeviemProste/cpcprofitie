// Detail-page parser for sauto.cz. Listings detail URL is the same anchor
// captured in `parseListingsPage` (e.g. /osobni/detail/skoda/octavia/<id>).

import * as cheerio from 'cheerio';
import type { NormalizedDetail, NormalizedListing, SellerType } from '../types';

export function detailUrl(listing: NormalizedListing): string {
  return listing.url;
}

export function parseDetailPage(html: string, listing: NormalizedListing): NormalizedDetail {
  const $ = cheerio.load(html);

  // Photos: sauto.cz serves images from the Seznam CDN (`d19-a.sdn.cz`).
  // Both <a href="//d19-a.sdn.cz/..."> and <img src="//d19-a.sdn.cz/..."> appear.
  const photos: string[] = [];
  const seen = new Set<string>();
  $('img[src*="sdn.cz"], a[href*="sdn.cz"]').each((_, el) => {
    const $el = $(el);
    let url = ($el.attr('src') ?? $el.attr('href') ?? '').trim();
    if (!url) return;
    // Protocol-relative — promote to https.
    if (url.startsWith('//')) url = `https:${url}`;
    if (!/^https?:\/\//.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);
    photos.push(url);
  });

  const fullText = $('body').text();

  // Specs are typically in <dl><dt>Label</dt><dd>Value</dd> pairs.
  function readSpec(label: string): string | null {
    let found: string | null = null;
    $('dt').each((_, el) => {
      const $dt = $(el);
      if ($dt.text().trim().toLowerCase().startsWith(label.toLowerCase())) {
        const $dd = $dt.next('dd');
        const val = $dd.text().trim();
        if (val) {
          found = val;
          return false;
        }
      }
      return undefined;
    });
    if (found) return found;
    // Fallback: free-text "Label: value" pattern.
    const re = new RegExp(`${label}\\s*:?\\s*([^\\n,;]+?)(?:\\s{2,}|\\n|,|;|$)`, 'i');
    const m = re.exec(fullText);
    return m?.[1]?.trim() ?? null;
  }

  const bodyType = readSpec('Karoserie') ?? readSpec('Karosérie');
  const colorExterior = readSpec('Barva');
  const colorInterior = readSpec('Barva interiéru');
  const powerKw = parseIntFromText(readSpec('Výkon'));
  const engineCcm = parseIntFromText(readSpec('Objem'));
  const vinRaw = readSpec('VIN');
  const vin = isPlausibleVin(vinRaw) ? vinRaw : null;

  // Seller: sauto.cz shows "Soukromý prodejce" for private and a company
  // name + IČO for dealers. We detect by the keyword in the body text.
  const sellerType: SellerType | null = /Soukrom[ýy]\s+prodejce/i.test(fullText)
    ? 'private'
    : /s\.r\.o\.|a\.s\.|s\.\s*r\.\s*o\.|spol\.\s*s\s*r\.\s*o\./i.test(fullText)
      ? 'dealer'
      : null;
  // Seller name: heading with company name or "Soukromý prodejce" literal.
  let sellerName: string | null = null;
  $('h2, h3, h4').each((_, el) => {
    const text = $(el).text().trim();
    if (/(s\.r\.o\.|a\.s\.|Soukrom[ýy])/i.test(text) && sellerName === null) {
      sellerName = text.length > 100 ? text.slice(0, 100) : text;
    }
  });

  // Equipment: bullet items inside sections titled
  // "Bezpečnostní systémy" / "Asistenční systémy" / "Komfort" etc.
  const equipment: string[] = [];
  $('li').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length < 3 || text.length > 80) return;
    if (/^\d/.test(text)) return;
    if (equipment.includes(text)) return;
    equipment.push(text);
  });

  // Description block: "Popis prodejce" panel.
  let description: string | null = null;
  $('p, div').each((_, el) => {
    if (description !== null) return;
    const text = $(el).text().trim();
    if (text.length >= 200 && text.length <= 6000) {
      description = text;
    }
  });

  return {
    source: listing.source,
    sourceId: listing.sourceId,
    photos,
    description,
    vin,
    bodyType,
    colorExterior,
    colorInterior,
    powerKw,
    engineCcm,
    sellerType,
    sellerName,
    equipment: equipment.slice(0, 200),
  };
}

function parseIntFromText(text: string | null): number | null {
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
