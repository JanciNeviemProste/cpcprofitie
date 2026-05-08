// Prompt templates for the AI listing generator. The system prompt is fixed
// per tone; the user prompt is a structured summary of the vehicle.

export type Tone = 'formal' | 'sales' | 'short';

export type ListingInput = {
  make: string;
  model: string;
  year: number | string;
  mileageKm: number | string;
  fuel?: string;
  transmission?: string;
  bodyType?: string;
  features?: string;
  priceEur?: number | string;
  tone: Tone;
};

const TONE_GUIDE: Record<Tone, string> = {
  formal:
    'Profesionálny, vecný tón. Žiadne emoji. Krátke odstavce, fakty pred adjektívmi. Hodí sa pre korporátnych klientov a fleet predaj.',
  sales:
    'Energický predajný tón, ale bez krikľavosti. Zdôrazni hodnotu, výhody, životný štýl. Použi 1–2 výzvy k akcii. Maximálne jedno emoji.',
  short:
    'Krátky a vecný formát pre marketplace. Titulok do 70 znakov. Telo do 6 riadkov. Iba kľúčové fakty, žiadny marketing fluff.',
};

const SYSTEM = `Si copywriter pre slovenský online autobazár. Píšeš inzeráty pre obchodníkov s vozidlami, ktorí potrebujú text za 30 sekúnd. Pravidlá:

1. Vždy v slovenčine, korektný pravopis a interpunkcia.
2. Najprv titulok (max 80 znakov), potom prázdny riadok, potom telo inzerátu.
3. Telo má 4–8 odsekov v zoznamovej alebo prozaickej forme — riaď sa zadanou tonalitou.
4. Žiadne odhady alebo neoverené údaje (nepovedz „prvý majiteľ", ak to nie je v zadaní).
5. Ak je v zadaní cena, uveď ju na konci. Ak chýba, neuvádzaj.
6. Žiadne kontaktné údaje, žiadne URL, žiadne hashtagy.
7. Vyhni sa klišé typu „TOP stav", „nutné vidieť", „pohotovo k prebraniu".`;

export function buildSystemPrompt(tone: Tone): string {
  return `${SYSTEM}\n\nTonalita: ${TONE_GUIDE[tone]}`;
}

export function buildUserPrompt(input: ListingInput): string {
  const lines = [
    `Značka: ${input.make}`,
    `Model: ${input.model}`,
    `Rok výroby: ${input.year}`,
    `Najazdené: ${input.mileageKm} km`,
  ];
  if (input.fuel) lines.push(`Palivo: ${input.fuel}`);
  if (input.transmission) lines.push(`Prevodovka: ${input.transmission}`);
  if (input.bodyType) lines.push(`Karoséria: ${input.bodyType}`);
  if (input.features?.trim()) lines.push(`Výbava a poznámky: ${input.features.trim()}`);
  if (input.priceEur) lines.push(`Predajná cena: ${input.priceEur} €`);
  lines.push('', 'Vygeneruj titulok a telo inzerátu.');
  return lines.join('\n');
}
