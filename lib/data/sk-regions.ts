// Slovak kraje (NUTS-3 regions). Listings come in with messy LAU-2 strings
// like "SK-010 01 Žilina" or free-form city names, so we match by patterns
// (ISO 3166-2 prefix + Slovak city/region substrings) instead of an exact map.

export type SkKraj = {
  name: string;
  patterns: string[]; // SQL ILIKE patterns
};

export const SK_KRAJE: SkKraj[] = [
  { name: 'Bratislavský', patterns: ['SK-1%', '%bratisl%', 'BA %', 'BA-%'] },
  { name: 'Trnavský', patterns: ['SK-2%', '%trnav%'] },
  { name: 'Trenčiansky', patterns: ['SK-3%', '%trenč%'] },
  { name: 'Nitriansky', patterns: ['SK-4%', '%nitr%'] },
  { name: 'Žilinský', patterns: ['SK-0%', '%žilin%'] },
  { name: 'Banskobystrický', patterns: ['SK-6%', '%bansk%'] },
  { name: 'Prešovský', patterns: ['SK-7%', '%prešov%'] },
  { name: 'Košický', patterns: ['SK-8%', '%košic%'] },
];

export function krajByName(name: string): SkKraj | undefined {
  return SK_KRAJE.find((k) => k.name === name);
}
