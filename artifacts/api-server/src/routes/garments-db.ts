import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  garments,
  profiles,
  insertGarmentSchema,
  updateGarmentSchema,
  activeGarmentsFilter,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureProfile(userId: string) {
  await db.insert(profiles).values({ id: userId }).onConflictDoNothing();
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/garments
 *
 * Returns all non-deleted garments for the authenticated user,
 * ordered by createdAt ascending.
 */
router.get("/garments", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(garments)
      .where(and(activeGarmentsFilter, eq(garments.userId, req.userId)))
      .orderBy(garments.createdAt);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "GET /garments failed");
    res.status(500).json({ error: "Failed to load garments." });
  }
});

/**
 * POST /api/garments
 *
 * Creates a new garment. Body is validated against insertGarmentSchema.
 * `userId` is always taken from the verified JWT, never the body.
 */
router.post("/garments", requireAuth, async (req, res) => {
  const parsed = insertGarmentSchema.safeParse({ ...req.body, userId: req.userId });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body.", details: parsed.error.flatten() });
    return;
  }

  try {
    await ensureProfile(req.userId);

    const [created] = await db
      .insert(garments)
      .values(parsed.data)
      .returning();

    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "POST /garments failed");
    res.status(500).json({ error: "Failed to create garment." });
  }
});

/**
 * PATCH /api/garments/:id
 *
 * Partially updates a garment. userId is enforced at the DB level.
 */
router.patch("/garments/:id", requireAuth, async (req, res) => {
  const id = req.params["id"] as string;

  const parsed = updateGarmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body.", details: parsed.error.flatten() });
    return;
  }

  try {
    const [updated] = await db
      .update(garments)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(garments.id, id), eq(garments.userId, req.userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Garment not found." });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /garments/:id failed");
    res.status(500).json({ error: "Failed to update garment." });
  }
});

/**
 * DELETE /api/garments/:id
 *
 * Soft-deletes the garment (status → 'deleted'). Row is retained for history.
 */
router.delete("/garments/:id", requireAuth, async (req, res) => {
  const id = req.params["id"] as string;

  try {
    const [deleted] = await db
      .update(garments)
      .set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(garments.id, id), eq(garments.userId, req.userId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Garment not found." });
      return;
    }

    res.json({ id: deleted.id, status: "deleted" });
  } catch (err) {
    req.log.error({ err }, "DELETE /garments/:id failed");
    res.status(500).json({ error: "Failed to delete garment." });
  }
});

/**
 * POST /api/garments/:id/wear
 *
 * Increments wearCount and sets lastWornAt to now.
 */
router.post("/garments/:id/wear", requireAuth, async (req, res) => {
  const id = req.params["id"] as string;

  try {
    const [existing] = await db
      .select({ wearCount: garments.wearCount })
      .from(garments)
      .where(and(eq(garments.id, id), eq(garments.userId, req.userId)));

    if (!existing) {
      res.status(404).json({ error: "Garment not found." });
      return;
    }

    const [updated] = await db
      .update(garments)
      .set({
        wearCount: (existing.wearCount ?? 0) + 1,
        lastWornAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(garments.id, id), eq(garments.userId, req.userId)))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "POST /garments/:id/wear failed");
    res.status(500).json({ error: "Failed to mark garment worn." });
  }
});

/**
 * POST /api/garments/:id/laundry
 * POST /api/garments/:id/clean
 *
 * Status transitions: active → laundry → active
 */
router.post("/garments/:id/laundry", requireAuth, async (req, res) => {
  const id = req.params["id"] as string;
  try {
    const [updated] = await db
      .update(garments)
      .set({ status: "laundry", updatedAt: new Date() })
      .where(and(eq(garments.id, id), eq(garments.userId, req.userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Garment not found." }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "POST /garments/:id/laundry failed");
    res.status(500).json({ error: "Failed to update garment status." });
  }
});

router.post("/garments/:id/clean", requireAuth, async (req, res) => {
  const id = req.params["id"] as string;
  try {
    const [updated] = await db
      .update(garments)
      .set({ status: "active", updatedAt: new Date() })
      .where(and(eq(garments.id, id), eq(garments.userId, req.userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Garment not found." }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "POST /garments/:id/clean failed");
    res.status(500).json({ error: "Failed to update garment status." });
  }
});

export default router;
