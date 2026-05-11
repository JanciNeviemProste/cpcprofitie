CREATE TYPE "public"."seller_type" AS ENUM('private', 'dealer');--> statement-breakpoint
CREATE TABLE "listing_details" (
	"listing_id" bigserial PRIMARY KEY NOT NULL,
	"body_type" varchar(32),
	"color_exterior" varchar(64),
	"color_interior" varchar(64),
	"power_kw" integer,
	"engine_ccm" integer,
	"vin" varchar(17),
	"seller_type" "seller_type",
	"seller_name" text,
	"description" text,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"detailed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"listing_id" bigserial NOT NULL,
	"position" integer NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer
);
--> statement-breakpoint
ALTER TABLE "listing_details" ADD CONSTRAINT "listing_details_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_photos_listing_position_idx" ON "listing_photos" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listing_photos_listing_idx" ON "listing_photos" USING btree ("listing_id");