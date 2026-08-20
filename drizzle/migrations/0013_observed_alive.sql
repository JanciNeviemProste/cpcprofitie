-- When did we last have evidence this listing actually existed?
--
-- 4 205 of our 4 223 "sales" were listings that were already dead the first time
-- we looked at them. The chain: a URL is imported (first_seen_at = now), detail
-- enrichment fetches the page, gets a 404, sets removed_at and writes a
-- description of '[GONE]'; sold-detector then sees removed_at, finds no
-- relisting, and records a sale. Average time to sell across the whole table:
-- 0.21 days. We never observed any of those cars on the market at all.
--
-- first_seen_at cannot answer "was it ever alive", because it is the moment we
-- imported the URL, not the moment the advert appeared — 87 648 of 87 917 rows
-- were imported from a corpus that already existed. This column is stamped only
-- when something confirms the listing was really there: a detail page that
-- parsed, or seeing it again on a list page after the import.
--
-- Deliberately a column rather than a filter on description <> '[GONE]'.
-- Keying a correctness rule off a magic string in a text column is the kind of
-- silent failure this work exists to remove: change the string and the filter
-- stops working with nothing to say so.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS first_seen_alive_at timestamptz;

-- Backfill from two independent kinds of evidence.
--
-- The first is a detail page that parsed. The second matters more than it looks:
-- a later list-page sighting bumps last_seen_at, and the gone path never does —
-- so last_seen_at moving after the import is proof the advert was still there.
--
-- Using only the detail evidence would have been wrong for 297 rows that were
-- re-seen on a list page and are about to have their sale cleared: they WERE
-- observed alive, just never successfully enriched. check-removed also marks a
-- listing removed on a 404 without writing any tombstone at all, so the
-- tombstone alone under-counts, and it under-counts more as enrichment coverage
-- grows.
UPDATE listings l
SET first_seen_alive_at = l.first_seen_at
WHERE l.first_seen_alive_at IS NULL
  AND (
    l.last_seen_at > l.first_seen_at + interval '5 minutes'
    OR EXISTS (
      SELECT 1 FROM listing_details d
      WHERE d.listing_id = l.id
        AND d.description IS NOT NULL
        AND d.description <> '[GONE]'
    )
  );

-- sold-detector filters on this, alongside removed_at.
CREATE INDEX IF NOT EXISTS listings_alive_removed_idx
  ON listings (first_seen_alive_at, removed_at)
  WHERE sold_at IS NULL;
