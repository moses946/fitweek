import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { profiles } from "./profiles";
import { outfitSlots } from "./outfit-slots";
import { garments } from "./garments";

// ── Enums ────────────────────────────────────────────────────────────────────

/**
 * vto_status — processing state of a virtual try-on request.
 *
 * - pending : request submitted to the VTO proxy; image not yet available
 * - ready   : image processed and stored; result_url is populated
 * - failed  : processing failed; error_message contains the reason
 */
export const vtoStatusEnum = pgEnum("vto_status", [
  "pending",
  "ready",
  "failed",
]);

// ── Table ────────────────────────────────────────────────────────────────────

export const vtoResults = pgTable(
  "vto_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /**
     * outfit_slot_id — nullable because VTO can be triggered outside a slot
     * (e.g. from the garment detail screen). ON DELETE SET NULL preserves
     * the VTO result even if the slot is deleted.
     */
    outfitSlotId: uuid("outfit_slot_id").references(() => outfitSlots.id, {
      onDelete: "set null",
    }),
    /**
     * garment_id — nullable for the same reason. ON DELETE SET NULL ensures
     * VTO history is preserved even if the garment is hard-purged.
     */
    garmentId: uuid("garment_id").references(() => garments.id, {
      onDelete: "set null",
    }),
    /**
     * storage_path — bucket-relative path (e.g. "vto/user_id/result_abc.webp").
     * Used to reconstruct URLs if the CDN prefix changes and for server-side
     * Storage cleanup when the row is deleted.
     */
    storagePath: text("storage_path"),
    /**
     * result_url — public CDN URL served to the client.
     * Populated when status transitions to 'ready'.
     */
    resultUrl: text("result_url"),
    status: vtoStatusEnum("status").notNull().default("pending"),
    /** error_message — populated when status is 'failed'. */
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Fast lookup: all VTO results for a given outfit slot
    index("vto_results_outfit_slot_id_idx").on(t.outfitSlotId),
    // Fast lookup: all VTO results for a given garment (history view)
    index("vto_results_garment_id_idx").on(t.garmentId),
  ],
);

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const insertVtoResultSchema = createInsertSchema(vtoResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectVtoResultSchema = createSelectSchema(vtoResults);

export const updateVtoResultSchema = insertVtoResultSchema.partial().omit({
  userId: true,
});

// ── TypeScript types ─────────────────────────────────────────────────────────

export type InsertVtoResult = z.infer<typeof insertVtoResultSchema>;
export type UpdateVtoResult = z.infer<typeof updateVtoResultSchema>;
export type VtoResult = typeof vtoResults.$inferSelect;
