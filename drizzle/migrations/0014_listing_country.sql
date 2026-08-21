-- Which country's market is this advert in?
--
-- autobazar.eu is a Czech-Slovak portal. The parser read location.name and
-- prefixed it with a hardcoded 'SK', so the table carries rows like
-- 'SK-okres Praha' (3 428), 'SK-Ostrava' (1 163) and 'SK-Brno' (1 001).
-- ~10 000 Czech cars were priced into the Slovak reference: 15% of it, moving
-- 981 cohort medians by more than 3% -- Skoda Fabia <2010/50-100k reads
-- 2 595 EUR where the Slovak-only median is 1 300 EUR.
--
-- Czech prices on this source are genuinely lower (median 13 700 EUR vs
-- 17 100 EUR), so the contamination is directional, not noise that averages
-- out: it makes every Slovak car look overpriced and every import look worse
-- than it is. The product makes exactly one claim -- "is this price good for
-- the SLOVAK market" -- and that claim was false by ~6%.
--
-- A column rather than a filter on the 'SK-'/'CZ-' region prefix, because
-- bazos.sk has a region on 0.5% of its rows: a predicate over region text
-- would drop that whole source from the reference.
--
-- NULL means "we do not know", and it is never to be read as 'SK'. Assuming
-- was the bug. Nothing here backfills autobazar.eu from the stored region
-- names: that was tried and does not work. The names miss thousands of Czech
-- towns (Kladno, Znojmo, Otrokovice, Usti nad Labem, Tabor, Cheb, Prerov...),
-- cannot decide ambiguous ones (Jesenice, Most, Ostrov, Benesov), and produce
-- outright false positives -- 'SK-Moravsky Svaty Jan' is a Slovak village in
-- Zahorie that any /moravsk/ rule marks Czech. The listing pages carry
-- location.parents, whose last element is the country's node id, so the
-- rotation fills this in with structural evidence instead of guesswork.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS country char(2);

-- The town or district exactly as the source names it. Kept separate from
-- `region` so the region can later be coarsened to a kraj without changing
-- what computeFingerprint hashes -- a coarser fingerprint key collides, and
-- that is the mechanism that once merged 681 Octavias into one cluster.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS locality varchar(64);

CREATE INDEX IF NOT EXISTS listings_country_model_idx ON listings (country, model_id);

-- bazos.sk and autobazar.sk are Slovak by construction, not by observation.
-- auto.bazos.sk is the Slovak site (bazos.cz is a separate domain and is not
-- in ALL_SOURCES), and autobazar-sk.ts's extractRegionHint only ever returns
-- one of the eight Slovak kraje. Neither can produce a foreign advert, so
-- these ~42 000 rows are settled here rather than waiting for a re-scrape.
UPDATE listings SET country = 'SK'
WHERE source IN ('bazos.sk', 'autobazar.sk') AND country IS NULL;
