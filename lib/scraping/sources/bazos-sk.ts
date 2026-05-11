import * as cheerio from 'cheerio';
import {
  parseEur,
  parseFuel,
  parseKm,
  parseMakeModel,
  parseTransmission,
  parseYear,
} from '../normalize';
import type { NormalizedListing } from '../types';
import type { ScraperSource } from './source-interface';

const BASE = 'https://auto.bazos.sk';

// Bazoš has a flat HTML structure with `.inzeratynadpis` blocks — tune
// against live DOM via WebFetch after first run.
const SEL = {
  card: '.inzeraty, .inzeratynadpis, [data-listing-id]',
  title: '.inzeratynadpis h2 a, h2 a, .nadpis a',
  link: 'a[href*="/inzerat/"]',
  price: '.inzeratycena, .cena',
  description: '.popis, .inzeratypopis',
  region: '.inzeratylok, .lokalita',
  // Bazoš puts year+km+fuel inside description text; we parse from there
  // as fallback.
} as const;

export function parseListingsPage(html: string): NormalizedListing[] {
  const $ = cheerio.load(html);
  const results: NormalizedListing[] = [];

  $(SEL.card).each((_, el) => {
    const $el = $(el);
    const $link = $el.find(SEL.link).first();
    const href = $link.attr('href');
    if (!href) return;
    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    const sourceId = extractListingId(url);
    if (!sourceId) return;

    const title = textOrNull($el.find(SEL.title).first());
    const description = textOrNull($el.find(SEL.description).first()) ?? title ?? '';
    const { makeSlug, modelSlug } = parseMakeModel(title);
    const priceEur = parseEur(textOrNull($el.find(SEL.price).first()));
    // Bazoš listings often embed year + km in the body. Try to parse them.
    const year = parseYear(description) ?? parseYear(title);
    const mileageKm = parseKm(extractKmHint(description));
    const fuel = parseFuel(extractFuelHint(description));
    const transmission = parseTransmission(extractTransmissionHint(description));
    const region = textOrNull($el.find(SEL.region).first());

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
      rawPayload: { html: $el.html() ?? '' },
    });
  });

  return results;
}

export const bazosSk: ScraperSource = {
  id: 'bazos.sk',
  baseUrl: BASE,
  pageUrl({ page }) {
    // Bazoš pagination: ?strana=N. Listings on the front page already cover
    // active inventory; deeper pages walk historical.
    return `${BASE}/?strana=${page}`;
  },
  parseListingsPage,
};

function textOrNull($el: { text(): string; length: number }): string | null {
  if ($el.length === 0) return null;
  const text = $el.text().trim();
  return text.length > 0 ? text : null;
}

function extractListingId(url: string): string | null {
  const m = /\/inzerat\/(\d+)/.exec(url);
  return m?.[1] ?? null;
}

function extractKmHint(text: string): string | null {
  const m = /(\d[\d\s]{2,})\s*(km|kilometr)/i.exec(text);
  return m?.[1] ?? null;
}

function extractFuelHint(text: string): string | null {
  const m = /\b(benzín|benzin|nafta|diesel|hybrid|elektro|lpg|cng)\b/i.exec(text);
  return m?.[1] ?? null;
}

function extractTransmissionHint(text: string): string | null {
  const m = /\b(manuálna|manuální|manual|automat|automatická)\b/i.exec(text);
  return m?.[1] ?? null;
}
