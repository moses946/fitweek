CREATE TYPE "public"."garment_status" AS ENUM('active', 'laundry', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."outfit_slot_status" AS ENUM('draft', 'confirmed', 'skipped', 'archived');--> statement-breakpoint
CREATE TYPE "public"."vto_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"model_photo_url" text,
	"location_city" text,
	"notifications_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"image_url" text NOT NULL,
	"bg_removed_url" text,
	"wear_count" integer DEFAULT 0 NOT NULL,
	"last_worn_at" timestamp with time zone,
	"status" "garment_status" DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outfit_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"planned_date" date NOT NULL,
	"garment_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"status" "outfit_slot_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vto_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"outfit_slot_id" uuid,
	"garment_id" uuid,
	"storage_path" text,
	"result_url" text,
	"status" "vto_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garments" ADD CONSTRAINT "garments_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfit_slots" ADD CONSTRAINT "outfit_slots_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vto_results" ADD CONSTRAINT "vto_results_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vto_results" ADD CONSTRAINT "vto_results_outfit_slot_id_outfit_slots_id_fk" FOREIGN KEY ("outfit_slot_id") REFERENCES "public"."outfit_slots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vto_results" ADD CONSTRAINT "vto_results_garment_id_garments_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garments_user_id_idx" ON "garments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "garments_user_id_category_idx" ON "garments" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "garments_tags_gin_idx" ON "garments" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "outfit_slots_user_id_planned_date_idx" ON "outfit_slots" USING btree ("user_id","planned_date");--> statement-breakpoint
CREATE UNIQUE INDEX "outfit_slots_user_id_planned_date_unique" ON "outfit_slots" USING btree ("user_id","planned_date");--> statement-breakpoint
CREATE INDEX "vto_results_outfit_slot_id_idx" ON "vto_results" USING btree ("outfit_slot_id");--> statement-breakpoint
CREATE INDEX "vto_results_garment_id_idx" ON "vto_results" USING btree ("garment_id");