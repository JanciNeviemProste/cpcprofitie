// Seeds vehicle_makes and vehicle_models with the most common cars on the SK
// market. Run once after `pnpm drizzle-kit push` puts the schema in place.
//
//   pnpm tsx scripts/seed-vehicles.ts
//
// Idempotent: re-running upserts the same rows without conflicting.

import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { vehicleMakes, vehicleModels } from '../lib/db/schema';

type Make = { id: number; slug: string; name: string };
type Model = { id: number; makeId: number; slug: string; name: string; bodyType: string };

const MAKES: Make[] = [
  { id: 1, slug: 'skoda', name: 'Škoda' },
  { id: 2, slug: 'volkswagen', name: 'Volkswagen' },
  { id: 3, slug: 'bmw', name: 'BMW' },
  { id: 4, slug: 'audi', name: 'Audi' },
  { id: 5, slug: 'mercedes-benz', name: 'Mercedes-Benz' },
  { id: 6, slug: 'hyundai', name: 'Hyundai' },
  { id: 7, slug: 'kia', name: 'Kia' },
  { id: 8, slug: 'ford', name: 'Ford' },
  { id: 9, slug: 'opel', name: 'Opel' },
  { id: 10, slug: 'renault', name: 'Renault' },
  { id: 11, slug: 'toyota', name: 'Toyota' },
  { id: 12, slug: 'peugeot', name: 'Peugeot' },
  { id: 13, slug: 'citroen', name: 'Citroën' },
  { id: 14, slug: 'mazda', name: 'Mazda' },
  { id: 15, slug: 'volvo', name: 'Volvo' },
];

function model(id: number, makeId: number, slug: string, name: string, bodyType: string): Model {
  return { id, makeId, slug, name, bodyType };
}

const MODELS: Model[] = [
  // Škoda
  model(101, 1, 'fabia', 'Fabia', 'hatchback'),
  model(102, 1, 'octavia', 'Octavia', 'wagon'),
  model(103, 1, 'superb', 'Superb', 'wagon'),
  model(104, 1, 'kamiq', 'Kamiq', 'suv'),
  model(105, 1, 'karoq', 'Karoq', 'suv'),
  model(106, 1, 'kodiaq', 'Kodiaq', 'suv'),
  // Volkswagen
  model(201, 2, 'polo', 'Polo', 'hatchback'),
  model(202, 2, 'golf', 'Golf', 'hatchback'),
  model(203, 2, 'passat', 'Passat', 'wagon'),
  model(204, 2, 'tiguan', 'Tiguan', 'suv'),
  model(205, 2, 'touareg', 'Touareg', 'suv'),
  model(206, 2, 'arteon', 'Arteon', 'sedan'),
  // BMW
  model(301, 3, '3-series', '3 Series', 'sedan'),
  model(302, 3, '5-series', '5 Series', 'sedan'),
  model(303, 3, 'x1', 'X1', 'suv'),
  model(304, 3, 'x3', 'X3', 'suv'),
  model(305, 3, 'x5', 'X5', 'suv'),
  // Audi
  model(401, 4, 'a3', 'A3', 'hatchback'),
  model(402, 4, 'a4', 'A4', 'sedan'),
  model(403, 4, 'a6', 'A6', 'sedan'),
  model(404, 4, 'q3', 'Q3', 'suv'),
  model(405, 4, 'q5', 'Q5', 'suv'),
  // Mercedes
  model(501, 5, 'a-class', 'A-Class', 'hatchback'),
  model(502, 5, 'c-class', 'C-Class', 'sedan'),
  model(503, 5, 'e-class', 'E-Class', 'sedan'),
  model(504, 5, 'glc', 'GLC', 'suv'),
  // Hyundai
  model(601, 6, 'i20', 'i20', 'hatchback'),
  model(602, 6, 'i30', 'i30', 'hatchback'),
  model(603, 6, 'tucson', 'Tucson', 'suv'),
  model(604, 6, 'kona', 'Kona', 'suv'),
  // Kia
  model(701, 7, 'rio', 'Rio', 'hatchback'),
  model(702, 7, 'ceed', 'Ceed', 'hatchback'),
  model(703, 7, 'sportage', 'Sportage', 'suv'),
  model(704, 7, 'sorento', 'Sorento', 'suv'),
  // Ford
  model(801, 8, 'fiesta', 'Fiesta', 'hatchback'),
  model(802, 8, 'focus', 'Focus', 'hatchback'),
  model(803, 8, 'mondeo', 'Mondeo', 'sedan'),
  model(804, 8, 'kuga', 'Kuga', 'suv'),
  // Opel
  model(901, 9, 'corsa', 'Corsa', 'hatchback'),
  model(902, 9, 'astra', 'Astra', 'hatchback'),
  model(903, 9, 'insignia', 'Insignia', 'sedan'),
  // Renault
  model(1001, 10, 'clio', 'Clio', 'hatchback'),
  model(1002, 10, 'megane', 'Mégane', 'hatchback'),
  model(1003, 10, 'kadjar', 'Kadjar', 'suv'),
  // Toyota
  model(1101, 11, 'yaris', 'Yaris', 'hatchback'),
  model(1102, 11, 'corolla', 'Corolla', 'hatchback'),
  model(1103, 11, 'rav4', 'RAV4', 'suv'),
  // Peugeot, Citroen, Mazda, Volvo (sample)
  model(1201, 12, '208', '208', 'hatchback'),
  model(1202, 12, '3008', '3008', 'suv'),
  model(1301, 13, 'c3', 'C3', 'hatchback'),
  model(1401, 14, '3', 'Mazda3', 'hatchback'),
  model(1501, 15, 'xc60', 'XC60', 'suv'),
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set — cannot seed.');
    process.exit(1);
  }
  const db = getDb();

  console.error(`Seeding ${MAKES.length} makes…`);
  await db
    .insert(vehicleMakes)
    .values(MAKES)
    .onConflictDoUpdate({
      target: vehicleMakes.id,
      set: { name: sql`excluded.name`, slug: sql`excluded.slug` },
    });

  console.error(`Seeding ${MODELS.length} models…`);
  await db
    .insert(vehicleModels)
    .values(MODELS)
    .onConflictDoUpdate({
      target: vehicleModels.id,
      set: {
        name: sql`excluded.name`,
        slug: sql`excluded.slug`,
        bodyType: sql`excluded.body_type`,
      },
    });

  console.error('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
