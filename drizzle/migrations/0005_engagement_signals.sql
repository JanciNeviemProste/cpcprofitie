ALTER TABLE "listings" ADD COLUMN "view_count" integer;
ALTER TABLE "listings" ADD COLUMN "is_featured" boolean NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN "seller_phone" varchar(32);
CREATE INDEX "listings_view_count_idx" ON "listings" ("view_count" DESC);
