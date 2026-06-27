import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * profiles — mirrors Supabase auth.users.
 *
 * The `id` column is intentionally NOT auto-generated — it must be set to the
 * Supabase `auth.users.id` UUID at insert time so foreign keys across tables
 * resolve correctly without a separate lookup.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // set to Supabase auth.users.id on insert
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  /**
   * modelPhotoUrl — Supabase Storage path (NOT a public URL) used by the VTO
   * pipeline. Signed URLs are generated on demand by the API server using the
   * service-role key. The storage bucket is private.
   */
  modelPhotoUrl: text("model_photo_url"),
  /**
   * email — Mirrors auth.users.email for fast profile reads without a join.
   * Kept in sync by the API server on every sign-in via POST /api/auth/sync.
   */
  email: text("email"),
  /**
   * birthdate — ISO 8601 date string (YYYY-MM-DD). Optional; used for
   * age-gated features and personalised recommendations.
   */
  birthdate: text("birthdate"),
  locationCity: text("location_city"),
  notificationsEnabled: boolean("notifications_enabled")
    .notNull()
    .default(false),
  /**
   * onboardingCompletedAt — set when the user finishes the onboarding flow.
   * NULL means onboarding is incomplete. This is the authoritative source;
   * the mobile app no longer uses AsyncStorage for this flag.
   */
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const insertProfileSchema = createInsertSchema(profiles).omit({
  createdAt: true,
  updatedAt: true,
});

export const selectProfileSchema = createSelectSchema(profiles);

export const updateProfileSchema = insertProfileSchema.partial().omit({
  id: true,
});

/** Returned when the client calls GET /api/profile — includes onboarding status. */
export const profileResponseSchema = selectProfileSchema;

// ── TypeScript types ─────────────────────────────────────────────────────────

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type Profile = typeof profiles.$inferSelect;
