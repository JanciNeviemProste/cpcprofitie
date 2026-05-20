CREATE TYPE "public"."confidence" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "flip_opportunities" (
	"listing_id" bigint PRIMARY KEY NOT NULL,
	"market_median_eur" numeric(10, 2) NOT NULL,
	"market_p25_eur" numeric(10, 2) NOT NULL,
	"discount_pct" numeric(5, 2) NOT NULL,
	"potential_gain_eur" numeric(10, 2) NOT NULL,
	"cohort_size" integer NOT NULL,
	"confidence" "confidence" NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_snapshots" DROP CONSTRAINT "market_snapshots_model_id_region_period_captured_on_pk";--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_model_id_region_year_bucket_mileage_bucket_period_captured_on_pk" PRIMARY KEY("model_id","region","year_bucket","mileage_bucket","period","captured_on");--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "canonical_listing_id" bigint;--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD COLUMN "year_bucket" varchar(8) NOT NULL DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD COLUMN "mileage_bucket" varchar(16) NOT NULL DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "flip_opportunities" ADD CONSTRAINT "flip_opportunities_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flip_opportunities_discount_idx" ON "flip_opportunities" USING btree ("discount_pct");--> statement-breakpoint
CREATE INDEX "flip_opportunities_gain_idx" ON "flip_opportunities" USING btree ("potential_gain_eur");--> statement-breakpoint
CREATE INDEX "flip_opportunities_confidence_idx" ON "flip_opportunities" USING btree ("confidence");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_canonical_listing_id_listings_id_fk" FOREIGN KEY ("canonical_listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_fingerprint_idx" ON "listings" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "listings_canonical_idx" ON "listings" USING btree ("canonical_listing_id");