// Slovak kraje (NUTS-3 regions). Listings come in with messy LAU-2 strings
// or free-form city names, so we match by patterns (Slovak city/region
// substrings) instead of an exact map.

export type SkKraj = {
  name: string;
  patterns: string[]; // SQL ILIKE patterns
};

// The 'SK-0%'…'SK-8%' patterns that used to sit here looked like a postal-code
// mapping and were wrong: 080 01 is Prešov, but 'SK-0%' claimed Žilinský. They
// were assumed dead because no scraper emits a numeric region — but a listing
// whose location text starts with digits reaches them, and three did:
// 'SK-289 12 Nymburk' (a CZECH town) was filed as Trnavský, and
// 'SK-15 km od Levíc' as Bratislavský instead of Nitriansky.
//
// Matching a postal code needs two digits, not one — Slovak ranges do not
// split on the first digit — so there is no cheap correct version of those
// patterns. Removed rather than fixed; the city substrings below carry the
// mapping, and a location we cannot place stays unplaced.
export const SK_KRAJE: SkKraj[] = [
  { name: 'Bratislavský', patterns: ['%bratisl%', 'BA %', 'BA-%'] },
  { name: 'Trnavský', patterns: ['%trnav%'] },
  { name: 'Trenčiansky', patterns: ['%trenč%'] },
  { name: 'Nitriansky', patterns: ['%nitr%'] },
  { name: 'Žilinský', patterns: ['%žilin%'] },
  { name: 'Banskobystrický', patterns: ['%bansk%'] },
  { name: 'Prešovský', patterns: ['%prešov%'] },
  { name: 'Košický', patterns: ['%košic%'] },
];

/**
 * The region as a person should read it: without the internal country prefix.
 *
 * `region` is stored as 'SK-Žilina' / 'CZ-Brno'. The prefix is how queries tell
 * the markets apart; it is not something to put in front of a dealer, and
 * buildExplainer was composing it into a Slovak sentence ("v regióne SK-Brno").
 */
export function displayRegion(region: string | null | undefined): string | null {
  if (!region) return null;
  const trimmed = region.trim();
  if (!trimmed) return null;
  return /^[A-Z]{2}-/.test(trimmed) ? trimmed.slice(3) : trimmed;
}

export function krajByName(name: string): SkKraj | undefined {
  return SK_KRAJE.find((k) => k.name === name);
}
