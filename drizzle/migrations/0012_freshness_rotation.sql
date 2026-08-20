-- Freshness: when was this price last actually read from the source?
--
-- last_seen_at cannot answer that. check-removed stamps it after a HEAD
-- request (app/api/cron/check-removed/route.ts:115), and a HEAD reads no
-- price — so two of three sources would report perfect freshness for ever
-- while their prices rotted. A freshness metric built on it would be a second
-- blind watchdog, which is the failure mode this whole line of work exists to
-- remove.
--
-- Only paths that genuinely re-read a price stamp this column: upsertListings
-- and the refresh branch of persistDetails.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_checked_at timestamptz;

-- Backfill: a row with a price was, at some point, read from a list page, and
-- last_seen_at is the best evidence we have of when. Wrong in the optimistic
-- direction for rows only ever touched by a HEAD check, which the first
-- rotation cycle corrects within days.
UPDATE listings SET price_checked_at = last_seen_at WHERE price_eur IS NOT NULL;

-- Stalest-first selection and the freshness percentiles both scan this.
CREATE INDEX IF NOT EXISTS listings_price_checked_idx
  ON listings (source, price_checked_at)
  WHERE canonical_listing_id IS NULL AND sold_at IS NULL AND removed_at IS NULL;

-- Where the page rotation has got to, per source.
--
-- A cursor rather than a function of the clock, because a page index is a
-- shifting coordinate over a moving population: new listings push everything
-- down, and editing a source's bucket list renumbers the whole space. A
-- stateless f(timestamp) would skip a killed run's slice for ever — the same
-- silent coverage hole being fixed here, wearing a different hat.
--
-- page_space is not optional. autobazar.eu takes its page argument modulo its
-- bucket count, so start_page = 900 against 847 buckets silently re-fetches
-- bucket 53: without knowing the size of the space, the rotation would report
-- progress while re-reading the same rows for ever.
CREATE TABLE IF NOT EXISTS scrape_cursors (
  source varchar(32) PRIMARY KEY,
  -- Next page to fetch. Advanced only AFTER the pages are persisted: repeating
  -- a slice is cheap, skipping one is the bug.
  next_page integer NOT NULL DEFAULT 1,
  -- Declared size of the page space, from the source definition. A change here
  -- resets the cursor and starts a new cycle.
  page_space integer,
  -- Highest page observed to return listings. Learned, because a source's real
  -- depth changes with its inventory and cannot be hardcoded.
  max_known_page integer,
  cycle_no integer NOT NULL DEFAULT 1,
  cycle_started_at timestamptz NOT NULL DEFAULT now(),
  -- Guards against a cursor wedged on a page that fails transiently for ever.
  consecutive_failures integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- What a run actually covered. "succeeded" on its own is not information when
-- a run can touch 1% of the corpus and say nothing about it.
ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS start_page integer;
ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS end_page integer;
ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS pages_ok integer NOT NULL DEFAULT 0;
ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS pages_empty integer NOT NULL DEFAULT 0;
ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS pages_not_found integer NOT NULL DEFAULT 0;
ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS pages_error integer NOT NULL DEFAULT 0;
ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS cycle_no integer;
ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS stopped_reason text;

-- Finds rows left behind by a function the platform killed mid-run. Today such
-- a run leaves no row at all, because recordScrapeRun is called after all the
-- work — so a whole source can vanish from a cycle with nothing to show for it.
CREATE INDEX IF NOT EXISTS scrape_runs_running_idx
  ON scrape_runs (started_at)
  WHERE status = 'running';
