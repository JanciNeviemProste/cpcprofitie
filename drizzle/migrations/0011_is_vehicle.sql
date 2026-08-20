-- Whole car, or a piece of one?
--
-- Bazoš sells both in the same category, and a part's title carries the brand
-- and model ("Ľavé bočné dvere Škoda Fabia"), so the catalog files it as a car.
-- DealScore is unaffected — it needs a year and a mileage a part never has —
-- but market_snapshots buckets missing values as `unknown`, so a €100 door
-- lands in the (octavia, unknown, unknown) cohort and drags its median.
--
-- Defaults to true: an unclassified listing is a car until something says
-- otherwise. Removing a real car from the market is the expensive mistake, and
-- nothing re-examines a listing once it has been classified.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_vehicle boolean NOT NULL DEFAULT true;

-- Snapshots and analytics read cars only, always alongside model_id.
CREATE INDEX IF NOT EXISTS listings_is_vehicle_model_idx
  ON listings (is_vehicle, model_id)
  WHERE is_vehicle = false;
