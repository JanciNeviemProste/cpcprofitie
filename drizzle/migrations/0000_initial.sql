CREATE TYPE "public"."fuel" AS ENUM('gasoline', 'diesel', 'hybrid', 'phev', 'electric', 'lpg', 'cng', 'other');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'plus', 'premium');--> statement-breakpoint
CREATE TYPE "public"."scrape_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('manual', 'automatic', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "ai_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"input_json" jsonb NOT NULL,
	"generated_title" text,
	"generated_body" text,
	"model_used" varchar(64),
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"type" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model_id" integer,
	"label" text,
	"vin" varchar(17),
	"year" integer,
	"mileage_km" integer,
	"purchase_price_eur" numeric(10, 2),
	"purchase_date" timestamp with time zone,
	"target_margin_eur" numeric(10, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" varchar(32) NOT NULL,
	"source_id" varchar(128) NOT NULL,
	"model_id" integer,
	"price_eur" numeric(10, 2),
	"year" integer,
	"mileage_km" integer,
	"fuel" "fuel",
	"transmission" "transmission",
	"region" varchar(64),
	"url" text NOT NULL,
	"raw_json" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sold_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"model_id" integer NOT NULL,
	"region" varchar(64) NOT NULL,
	"period" varchar(8) NOT NULL,
	"captured_on" timestamp with time zone NOT NULL,
	"avg_price_eur" numeric(10, 2),
	"median_price_eur" numeric(10, 2),
	"p25_price_eur" numeric(10, 2),
	"p75_price_eur" numeric(10, 2),
	"count_active" integer DEFAULT 0 NOT NULL,
	"count_sold" integer DEFAULT 0 NOT NULL,
	"days_to_sell_avg" numeric(6, 2),
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_snapshots_model_id_region_period_captured_on_pk" PRIMARY KEY("model_id","region","period","captured_on")
);
--> statement-breakpoint
CREATE TABLE "scrape_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" varchar(32) NOT NULL,
	"status" "scrape_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"listings_added" integer DEFAULT 0 NOT NULL,
	"listings_updated" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"locale" varchar(5) DEFAULT 'sk' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicle_makes" (
	"id" integer PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_makes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vehicle_models" (
	"id" integer PRIMARY KEY NOT NULL,
	"make_id" integer NOT NULL,
	"slug" varchar(96) NOT NULL,
	"name" varchar(128) NOT NULL,
	"body_type" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model_id" integer,
	"region" varchar(64),
	"min_price_eur" numeric(10, 2),
	"max_price_eur" numeric(10, 2),
	"min_year" integer,
	"max_mileage_km" integer,
	"fuel" "fuel",
	"notify_by_email" boolean DEFAULT true NOT NULL,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_listings" ADD CONSTRAINT "ai_listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garage" ADD CONSTRAINT "garage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garage" ADD CONSTRAINT "garage_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_listings_user_created_idx" ON "ai_listings" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "events_user_created_idx" ON "events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "garage_user_id_idx" ON "garage" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_source_source_id_idx" ON "listings" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "listings_model_id_first_seen_idx" ON "listings" USING btree ("model_id","first_seen_at");--> statement-breakpoint
CREATE INDEX "listings_region_idx" ON "listings" USING btree ("region");--> statement-breakpoint
CREATE INDEX "market_snapshots_model_period_idx" ON "market_snapshots" USING btree ("model_id","period","captured_on");--> statement-breakpoint
CREATE INDEX "scrape_runs_source_started_idx" ON "scrape_runs" USING btree ("source","started_at");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_models_make_slug_idx" ON "vehicle_models" USING btree ("make_id","slug");--> statement-breakpoint
CREATE INDEX "vehicle_models_name_idx" ON "vehicle_models" USING btree ("name");--> statement-breakpoint
CREATE INDEX "watchlist_user_id_idx" ON "watchlist" USING btree ("user_id");