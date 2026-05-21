CREATE TABLE "listing_price_history" (
  "listing_id" bigint NOT NULL REFERENCES "listings"("id") ON DELETE CASCADE,
  "recorded_on" date NOT NULL,
  "price_eur" numeric(10,2) NOT NULL,
  PRIMARY KEY ("listing_id", "recorded_on")
);
CREATE INDEX "listing_price_history_recorded_on_idx" ON "listing_price_history" ("recorded_on");
