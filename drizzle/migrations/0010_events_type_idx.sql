-- Notification backstop queries (watchlist alerts, weekly digest) filter
-- events by (type, created_at); the existing index covers (user_id,
-- created_at) only, so every cron run would seq-scan the growing table.
CREATE INDEX IF NOT EXISTS "events_type_created_idx" ON "events" ("type", "created_at");
