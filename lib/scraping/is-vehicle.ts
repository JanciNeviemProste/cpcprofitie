// Is this listing a car, or a piece of one?
//
// Bazoš sells both under the same category, and a part carries the brand and
// model in its title — "Kufor s krídlom + zadné svetlá škoda Octavia 1" — so
// parseMakeModel attaches it to the catalog exactly like a car. In a sample of
// eight "cars without a year", five were parts.
//
// This does not corrupt DealScore, which needs a year and a mileage a part
// never has. It corrupts market_snapshots, which buckets missing values as
// `unknown`: a EUR 100 door lands in the cohort (octavia, unknown, unknown) and
// drags its median to a number that describes nothing.
//
// Two deliberate limits:
//
// Titles only, never descriptions. A genuine car ad routinely mentions parts —
// "po výmene rozvodov", "nové brzdy, tlmiče" — so scanning the description
// would flag the very listings we most want to keep.
//
// A false positive costs more than a false negative. Mislabelling a part leaves
// one bad row in a cohort of hundreds; mislabelling a car removes it from the
// market entirely, and it will not come back on the next run because nothing
// re-examines a listing already classified. So every word below was checked
// against real titles before being kept, and most candidates did not survive.

/**
 * Words that only appear when the thing for sale is not a whole car.
 *
 * Matched on stems against a diacritic-stripped title, because sellers write
 * "dvere", "dverí", "dverami" and skip accents about half the time.
 *
 * Every entry here scores zero or near-zero against listings carrying both a
 * year and a mileage — as close to a known-cars set as this data offers. The
 * words that did not survive that check are listed in REJECTED below; the list
 * is short because most part words double as equipment words.
 */
const PART_STEMS = [
  'narazni', // nárazník, nárazníky
  'blatnik',
  'kapota',
  'calunenie',
  'zamok bezpecnostneho pasu',
  'disky',
  'elektrony',
  'sada kolies',
  'rozpredam', // breaking for parts — not a car on sale either
  'kupim', // a wanted ad, no price of its own to average
];

//
// Tried and rejected against the data rather than by guessing. Each appears in
// genuine whole-car titles, where it names equipment or body style:
//
//   dver     "BMW 118i 5-dverové", "Kia Ceed hatchback, 5 dverí",
//            "Toyota Hilux 2-dver. dlha korba", "Citan ... bočné dvere"
//   sedadl   "ventilované sedadlá", "M-sedadlá", "Vyhr.Volant+Sedadlá",
//            "el. sedadlo vodiča"
//   volant   "Vyhrievaný volant" — equipment, in the same breath as the seats
//   pneu     "FIAT PANDA - KLIMA-TAZNE-SEZONNE PNEU", "BMW 520D + sada 4
//            kolies so zimnymi pneu"; genuine tyre ads carry a size instead,
//            which PART_DIMENSION_RE catches
//   svetla   "Skoda superb 2,0 TDi dsg 2022 full led svetla"
//   kufor    "BMW X3 xDrive20d A/T/Led/El.kufor/Virtual"
//   motor    the most common word in a genuine ad ("motor 2.0 TDI, 110 kW")
//
// Doors are the painful one: "Ľavé bočné dvere Škoda Fabia" is exactly what
// this was built to catch, and it cannot be caught without also flagging every
// five-door hatchback. That trade is the right way round, and it is tested.

/**
 * Sizes that only ever describe a wheel or a tyre: "205/55 R16" and bolt
 * patterns like "5x112".
 *
 * The bolt pattern is pinned to 4–6 studs on a 100–139 mm circle, which is the
 * whole range in use. Left looser it reads model codes as wheels — "Jaguar XK
 * 4.2 X150" matched a bare digit-x-number and lost a real car.
 */
const PART_DIMENSION_RE = /\b\d{3}\s*\/\s*\d{2}\s*r\s*\d{2}\b|\b[456]\s*x\s*1[0-3]\d([.,]\d)?\b/i;

/** "ráfik" needs a word boundary of its own: as a bare substring it matches
 *  inside "Renault Trafic", which folds to "trafik". */
const RIM_RE = /\brafik/;

export function isVehicleTitle(title: string | null | undefined): boolean {
  if (!title) return true; // Nothing to judge on — assume a car and leave it in.
  const t = fold(title);
  if (PART_DIMENSION_RE.test(t) || RIM_RE.test(t)) return false;
  return !PART_STEMS.some((stem) => t.includes(stem));
}

/** Lowercase and strip diacritics, so one entry covers "dvere" and "dverí"
 *  as well as the unaccented spellings half of Bazoš uses. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
