// Is this listing a car, or a piece of one?
//
// Bazoš sells both under the same category, and a part carries the brand and
// model in its title — "Kufor s krídlom + zadné svetlá škoda Octavia 1" — so
// parseMakeModel attaches it to the catalog exactly like a car. In a sample of
// eight "cars without a year", five were parts: a seat-belt buckle, bumpers,
// door trim, a boot lid with lights.
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
// re-examines a listing already classified. So the list stays narrow and every
// entry has to be a word that has no business in a whole-car ad.

/** Words that only appear when the thing for sale is not a whole car.
 *  Diacritic-insensitive and matched on stems, since sellers write "dvere",
 *  "dverí", "dverami" and skip accents about half the time. */
const PART_STEMS = [
  'narazni', // nárazník, nárazníky
  'blatnik',
  'kapota',
  'dver', // dvere, dverí — but see WHOLE_CAR_PHRASES
  'zamok bezpecnostneho pasu',
  'calunenie',
  'sedadl',
  'volant',
  'disky',
  'elektrony',
  'rafik',
  'sada kolies',
  'rozpredam',
  'kupim',
];

// Four words were tried and rejected against the data rather than by guessing.
// Of 5 599 bazoš listings carrying both a year and a mileage — as close to a
// known-cars set as this data offers — these are the titles they appear in:
//
//   pneu    "FIAT PANDA 4x4 - KLIMA-TAZNE-SEZONNE PNEU", "BMW 520D + sada 4
//           kolies so zimnymi pneu" — a selling point, not the goods. Genuine
//           tyre ads carry their size, which PART_DIMENSION_RE catches instead.
//   svetla  "Skoda superb 2,0 TDi dsg 2022 full led svetla", "Tesla Model 3
//           Long Range AWD, Matrix svetla"
//   kufor   "BMW X3 xDrive20d A/T/Led/El.kufor/Virtual"
//   motor   the single most common word in a genuine ad ("motor 2.0 TDI,
//           110 kW"); it would flag thousands of cars to catch a few engines.
//
// The cost of that restraint is real and accepted: "Kufor s kridlom + zadne
// svetla skoda Octavia 1" is a part this will not catch.

/** Dimensions that only ever describe a wheel or a tyre: "205/55 R16",
 *  "5x112" bolt patterns. A whole-car title has no reason to carry either. */
const PART_DIMENSION_RE = /\b\d{3}\s*\/\s*\d{2}\s*r\s*\d{2}\b|\b\d\s*x\s*1\d{2}([.,]\d)?\b/i;

/** Phrases that contain a part stem but describe a whole car. Checked first,
 *  because "5 dverove kombi" is a body style, not a door for sale. */
const WHOLE_CAR_PHRASES = [/\b[35]\s*-?\s*dver/, /\bdverov[ye]\b/];

export function isVehicleTitle(title: string | null | undefined): boolean {
  if (!title) return true; // Nothing to judge on — assume a car and leave it in.
  const t = fold(title);
  if (WHOLE_CAR_PHRASES.some((re) => re.test(t))) return true;
  if (PART_DIMENSION_RE.test(t)) return false;
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
