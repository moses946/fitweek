import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { profiles } from "./profiles";

// ── Enums ────────────────────────────────────────────────────────────────────

/**
 * outfit_slot_status — lifecycle state of a planned outfit for a given day.
 *
 * - draft     : AI-suggested or user-started; not yet committed
 * - confirmed : user locked this outfit in for the day
 * - skipped   : user dismissed the day; no outfit planned
 * - archived  : auto-archived after the slot's date has passed (cron job)
 */
export const outfitSlotStatusEnum = pgEnum("outfit_slot_status", [
  "draft",
  "confirmed",
  "skipped",
  "archived",
]);

// ── Table ────────────────────────────────────────────────────────────────────

export const outfitSlots = pgTable(
  "outfit_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /**
     * planned_date — ISO 8601 date string (YYYY-MM-DD).
     * Together with user_id, forms a unique key: one slot per user per day.
     */
    plannedDate: date("planned_date").notNull(),
    /**
     * garment_ids — ordered list of garment UUIDs that make up this outfit.
     * Stored as a UUID array to avoid a separate join table for a simple ordered list.
     */
    garmentIds: uuid("garment_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
    status: outfitSlotStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Fast lookup: all slots for a user ordered by date (planner week view)
    index("outfit_slots_user_id_planned_date_idx").on(t.userId, t.plannedDate),
    // Enforce one slot per user per day at the DB level
    uniqueIndex("outfit_slots_user_id_planned_date_unique").on(
      t.userId,
      t.plannedDate,
    ),
  ],
);

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const insertOutfitSlotSchema = createInsertSchema(outfitSlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectOutfitSlotSchema = createSelectSchema(outfitSlots);

export const updateOutfitSlotSchema = insertOutfitSlotSchema.partial().omit({
  userId: true,
  plannedDate: true,
});

// ── TypeScript types ─────────────────────────────────────────────────────────

export type InsertOutfitSlot = z.infer<typeof insertOutfitSlotSchema>;
export type UpdateOutfitSlot = z.infer<typeof updateOutfitSlotSchema>;
export type OutfitSlot = typeof outfitSlots.$inferSelect;
