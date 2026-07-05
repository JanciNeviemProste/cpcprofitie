import * as cheerio from 'cheerio';
import {
  extractFuelHintFromText,
  extractTransmissionHintFromText,
  parseFuel,
  parseMakeModel,
  parseTransmission,
} from '../normalize';
import type { NormalizedListing } from '../types';
import { detailUrl, parseDetailPage } from './bazos-sk-detail';
import type { CheerioNode, ScraperSource } from './source-interface';

const BASE = 'https://auto.bazos.sk';

// Bazoš listing URL: /inzerat/<numericId>/<slug>.php
const LISTING_URL_RE = /^\/inzerat\/(\d+)\/[^?#]*\.php$/;

// Listing block structure on auto.bazos.sk:
//
//   <div class="inzeratynadpis">         ← thumbnail container
//     <a href="/inzerat/{id}/...">
//       <img src="https://www.bazos.sk/img/..." class="obrazek" alt="Title">
//     </a>
//   </div>
//   <h2 class="nadpis"><a href="/inzerat/{id}/...">Title</a></h2>
//   <span class="velikost10"> - [DD.M. YYYY] </span>  ← post date, NOT car year
//   <div class="popis">Description with r.v., km, Diesel, kW…</div>
//   <div class="inzeratycena"><b><span translate="no">15 490 €</span></b></div>
//
// The pieces aren't wrapped in a single container — siblings flow inside
// the parent flex layout. We anchor on the first inzeratynadpis div per
// listing and walk the next siblings until we hit the cena div.

export function parseListingsPage(html: string): NormalizedListing[] {
  const $ = cheerio.load(html);
  const results: NormalizedListing[] = [];
  const seen = new Set<string>();

  $('div.inzeratynadpis').each((_, el) => {
    const $thumb = $(el);
    const $anchor = $thumb.find('a[href*="/inzerat/"]').first();
    const href = $anchor.attr('href');
    if (!href) return;
    const match = LISTING_URL_RE.exec(href);
    if (!match) return;
    const sourceId = match[1]!;
    if (seen.has(sourceId)) return;
    seen.add(sourceId);

    const url = `${BASE}${href}`;
    const thumbnailUrl = $thumb.find('img.obrazek').attr('src') ?? null;
    const altTitle = $thumb.find('img.obrazek').attr('alt')?.trim() ?? null;

    // The h2/popis/cena siblings flow flat after the thumb div until the next
    // inzeratynadpis (i.e. start of the next listing). Use nextUntil() to grab
    // exactly that range, then pluck the structured children by class.
    const $block = $thumb.nextUntil('div.inzeratynadpis');
    const titleFromH2 = $block
      .filter('h2.nadpis, span.nadpis')
      .add($block.find('h2.nadpis, span.nadpis'))
      .first()
      .text()
      .trim();
    const title = titleFromH2 || altTitle || null;
    const popisText = $block
      .filter('div.popis')
      .add($block.find('div.popis'))
      .first()
      .text();
    const $cena = $block.filter('div.inzeratycena').add($block.find('div.inzeratycena')).first();
    const priceText = $cena.find('span[translate="no"]').text().trim() || $cena.text().trim();

    const { makeSlug, modelSlug } = parseMakeModel(title);
    const priceEur = parseBazosPrice(priceText);
    const year = parseBazosYear(popisText);
    const mileageKm = parseBazosKm(popisText);
    const fuel = parseFuel(extractFuelHintFromText(popisText));
    const transmission = parseTransmission(extractTransmissionHintFromText(popisText));

    // Engagement signals: view count, PRO/featured flag, seller phone.
    // All best-effort — return undefined if the selector/regex misses so
    // persist coalesces don't clobber an existing value.
    const blockText = $block.text();
    const viewCount = parseBazosViewCount($, $block);
    const isFeatured = parseBazosFeatured($, $block);
    const sellerPhone = parsePhoneFromText(blockText);

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
      region: null, // bazos list-page has no location, populated by detail enrichment
      rawTitle: title,
      rawPayload: thumbnailUrl
        ? { capturedAt: new Date().toISOString(), thumbnailUrl }
        : { capturedAt: new Date().toISOString() },
      viewCount,
      isFeatured,
      sellerPhone,
    });
  });

  return results;
}

// Bazoš prices appear as "15 490 €" or "  15490 €". Keep a tight regex that
// requires the € sign so we don't accidentally pick up phone numbers etc.
function parseBazosPrice(text: string | null): number | null {
  if (!text) return null;
  const m = /(\d[\d\s]{0,12})\s*€/.exec(text);
  if (!m) return null;
  const n = Number(m[1]!.replace(/\s/g, ''));
  return Number.isFinite(n) && n >= 100 && n < 10_000_000 ? n : null;
}

// Year extraction needs to dodge the post-date "[20.5. 2026]" header that
// bazos puts on every listing. Strategy:
// 1. Match "r.v.: 12/2013" or "r. v. 2014" form first — these are unambiguous.
// 2. Fallback to a bare 4-digit year in popis between 1990 and current year - 0,
//    excluding the current year (2026) which is almost certainly the post date.
function parseBazosYear(popis: string | null): number | null {
  if (!popis) return null;
  const direct = /r\.?\s*v\.?\s*[:\.]?\s*(?:\d{1,2}\s*\/\s*)?(\d{4})/i.exec(popis);
  if (direct && Number.isFinite(Number(direct[1]))) {
    const n = Number(direct[1]);
    if (n >= 1980 && n <= new Date().getFullYear() + 1) return n;
  }
  const currentYear = new Date().getFullYear();
  const re = /\b(19[89]\d|20\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(popis)) !== null) {
    const n = Number(m[0]);
    if (n >= 1980 && n < currentYear) return n;
  }
  return null;
}

// Km extraction: prefer the "<number> km" form within popis, but reject "0 km"
// which is almost always a placeholder / new-car listing marker.
function parseBazosKm(popis: string | null): number | null {
  if (!popis) return null;
  const m = /(\d[\d\s]{2,8})\s*km\b/i.exec(popis);
  if (!m) return null;
  const n = Number(m[1]!.replace(/\s/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n >= 2_000_000) return null;
  return n;
}

// Bazoš shows view counts like "12×" in a span.velikost10. Multiple
// velikost10 spans exist per card (post-date is also one); pick the one
// whose text matches the "N×" / "N krát" pattern.
function parseBazosViewCount(
  $: cheerio.CheerioAPI,
  $block: cheerio.Cheerio<CheerioNode>,
): number | undefined {
  const candidates = $block
    .filter('span.velikost10, span.velikost11')
    .add($block.find('span.velikost10, span.velikost11'));
  let best: number | undefined;
  candidates.each((_, el) => {
    const t = $(el).text().trim();
    const m = /(\d[\d\s]*)\s*[×x]/i.exec(t) || /(\d[\d\s]*)\s*krát/i.exec(t);
    if (!m) return;
    const n = Number(m[1]!.replace(/\s/g, ''));
    if (Number.isFinite(n) && n >= 0 && n < 10_000_000) {
      best = n;
      return false;
    }
  });
  return best;
}

// PRO/TOP markers on bazos.sk are rendered as <b class="bazoslogo">PRO</b>
// or a span carrying TOP / PRO text. We search the block scope only.
function parseBazosFeatured(
  $: cheerio.CheerioAPI,
  $block: cheerio.Cheerio<CheerioNode>,
): boolean | undefined {
  const logos = $block
    .filter('b.bazoslogo, span.bazoslogo, b.toplogo, span.toplogo')
    .add($block.find('b.bazoslogo, span.bazoslogo, b.toplogo, span.toplogo'));
  if (logos.length === 0) return undefined;
  let found = false;
  logos.each((_, el) => {
    const t = $(el).text().trim().toUpperCase();
    if (t === 'PRO' || t === 'TOP' || t.startsWith('PRO ') || t.startsWith('TOP ')) {
      found = true;
      return false;
    }
  });
  return found || undefined;
}

// SK phone-ish numbers: local "0901 234 567", "0901 234567", or "+421 901 234 567".
// Conservative regex — refuses to pick up bare 9-digit numbers (would catch
// post IDs etc.).
const PHONE_RE =
  /(?:\+421\s?\d{3}\s?\d{3}\s?\d{3}|\b0\d{2,3}\s?\d{3}\s?\d{3,4}\b)/;

function parsePhoneFromText(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const m = PHONE_RE.exec(text);
  if (!m) return undefined;
  return m[0].replace(/\s+/g, ' ').trim().slice(0, 32);
}

export const bazosSk: ScraperSource = {
  id: 'bazos.sk',
  baseUrl: BASE,
  pageUrl({ page }) {
    // Bazoš pagination is offset-based: /, /20/, /40/, … 20 per page.
    const offset = (page - 1) * 20;
    return `${BASE}/${offset === 0 ? '' : `${offset}/`}`;
  },
  parseListingsPage,
  detailUrl,
  parseDetailPage,
};
