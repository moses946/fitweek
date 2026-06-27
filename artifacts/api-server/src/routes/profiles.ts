import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, profiles, updateProfileSchema } from "@workspace/db";

const router = Router();

/**
 * GET /api/profile
 *
 * Returns the authenticated user's profile row.
 *
 * Profile rows are now created automatically by the database trigger
 * `on_auth_user_created` (see migration.sql). A row will always exist
 * for any authenticated user — no upsert-or-create needed here.
 *
 * Returns 404 if the row is missing (shouldn't happen in production
 * but useful as a safety net during development).
 */
router.get("/profile", async (req, res) => {
  try {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, req.userId));

    if (!profile) {
      // Trigger didn't fire (pre-migration user or local dev without trigger)
      // Create a minimal row on the fly as a fallback.
      const [created] = await db
        .insert(profiles)
        .values({ id: req.userId })
        .onConflictDoNothing()
        .returning();

      res.status(201).json(created ?? { id: req.userId });
      return;
    }

    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "GET /profile failed");
    res.status(500).json({ error: "Failed to fetch profile." });
  }
});

/**
 * PATCH /api/profile
 *
 * Updates editable profile fields: displayName, avatarUrl, modelPhotoUrl,
 * birthdate, locationCity, notificationsEnabled.
 *
 * Note: `modelPhotoUrl` stores the Storage PATH (not a public URL).
 * Clients that need a signed URL should call GET /api/auth/model-photo-url.
 */
router.patch("/profile", async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body.", details: parsed.error.flatten() });
    return;
  }

  try {
    const [updated] = await db
      .update(profiles)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(profiles.id, req.userId))
      .returning();

    if (!updated) {
      // Row doesn't exist (pre-migration user) — upsert as fallback
      const [upserted] = await db
        .insert(profiles)
        .values({ id: req.userId, ...parsed.data })
        .onConflictDoUpdate({
          target: profiles.id,
          set: { ...parsed.data, updatedAt: new Date() },
        })
        .returning();
      res.json(upserted);
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /profile failed");
    res.status(500).json({ error: "Failed to update profile." });
  }
});

export default router;
