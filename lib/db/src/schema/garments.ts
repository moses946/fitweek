import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { profiles } from "./profiles";

// ── Enums ────────────────────────────────────────────────────────────────────

/**
 * garment_status — lifecycle state of a wardrobe item.
 *
 * - active   : visible in closet and suggestions
 * - laundry  : temporarily excluded from suggestions
 * - deleted  : soft-deleted; excluded from all queries via activeGarmentsFilter
 */
export const garmentStatusEnum = pgEnum("garment_status", [
  "active",
  "laundry",
  "deleted",
]);

// ── Table ────────────────────────────────────────────────────────────────────

export const garments = pgTable(
  "garments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    color: text("color").notNull().default(""),
    /**
     * tags — flat string array from Vision API labels (e.g. ["T-shirt", "Casual"]).
     * Indexed with a GIN index for fast @> (contains) queries.
     */
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    imageUrl: text("image_url").notNull(),
    /** bg_removed_url — Supabase Storage URL after background removal pipeline. */
    bgRemovedUrl: text("bg_removed_url"),
    wearCount: integer("wear_count").notNull().default(0),
    lastWornAt: timestamp("last_worn_at", { withTimezone: true }),
    status: garmentStatusEnum("status").notNull().default("active"),
    /** deleted_at — set when status transitions to 'deleted'; used for purge cron. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Fast lookup: all garments for a user
    index("garments_user_id_idx").on(t.userId),
    // Fast lookup: garments by category for a user (suggestion engine hot path)
    index("garments_user_id_category_idx").on(t.userId, t.category),
    // GIN index: fast array containment queries (e.g. tags @> '{navy}')
    index("garments_tags_gin_idx").using("gin", t.tags),
  ],
);

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const insertGarmentSchema = createInsertSchema(garments, {
  // drizzle-zod@0.7 generates lastWornAt as z.date() which rejects null/undefined
  // from the frontend. Override to accept any nullish value — the server sets this
  // via the wear endpoint, never on insert.
  lastWornAt: z.date().nullish(),
}).omit({
  id: true,
  wearCount: true,
  lastWornAt: true,  // never set on insert; only via POST /garments/:id/wear
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const selectGarmentSchema = createSelectSchema(garments);

export const updateGarmentSchema = createInsertSchema(garments, {
  // Accept ISO strings or Dates or null for timestamp fields on update
  lastWornAt: z.union([z.date(), z.string().datetime(), z.null()]).optional(),
}).partial().omit({
  userId: true,
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ── TypeScript types ─────────────────────────────────────────────────────────

export type InsertGarment = z.infer<typeof insertGarmentSchema>;
export type UpdateGarment = z.infer<typeof updateGarmentSchema>;
export type Garment = typeof garments.$inferSelect;
