import { Router } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  db,
  outfitSlots,
  profiles,
  insertOutfitSlotSchema,
  updateOutfitSlotSchema,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function ensureProfile(userId: string) {
  await db.insert(profiles).values({ id: userId }).onConflictDoNothing();
}

/**
 * GET /api/outfit-slots
 *
 * Returns outfit slots for the authenticated user.
 * Optional query params:
 *   ?from=YYYY-MM-DD  — filter slots on or after this date
 *   ?to=YYYY-MM-DD    — filter slots on or before this date
 */
router.get("/outfit-slots", requireAuth, async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };

  try {
    const conditions = [eq(outfitSlots.userId, req.userId)];
    if (from) conditions.push(gte(outfitSlots.plannedDate, from));
    if (to) conditions.push(lte(outfitSlots.plannedDate, to));

    const rows = await db
      .select()
      .from(outfitSlots)
      .where(and(...conditions))
      .orderBy(outfitSlots.plannedDate);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "GET /outfit-slots failed");
    res.status(500).json({ error: "Failed to load outfit slots." });
  }
});

/**
 * POST /api/outfit-slots
 *
 * Creates or replaces a draft slot for a given date.
 * Uses ON CONFLICT DO UPDATE so callers can call this idempotently.
 */
router.post("/outfit-slots", requireAuth, async (req, res) => {
  const parsed = insertOutfitSlotSchema.safeParse({
    ...req.body,
    userId: req.userId,
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body.", details: parsed.error.flatten() });
    return;
  }

  try {
    await ensureProfile(req.userId);

    const [upserted] = await db
      .insert(outfitSlots)
      .values(parsed.data)
      .onConflictDoUpdate({
        target: [outfitSlots.userId, outfitSlots.plannedDate],
        set: {
          garmentIds: parsed.data.garmentIds,
          status: parsed.data.status ?? "draft",
          notes: parsed.data.notes,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.status(201).json(upserted);
  } catch (err) {
    req.log.error({ err }, "POST /outfit-slots failed");
    res.status(500).json({ error: "Failed to create outfit slot." });
  }
});

/**
 * PATCH /api/outfit-slots/:id
 *
 * Partially updates an outfit slot (e.g. status, garmentIds, notes).
 */
router.patch("/outfit-slots/:id", requireAuth, async (req, res) => {
  const id = req.params["id"] as string;

  const parsed = updateOutfitSlotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body.", details: parsed.error.flatten() });
    return;
  }

  try {
    const [updated] = await db
      .update(outfitSlots)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(outfitSlots.id, id), eq(outfitSlots.userId, req.userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Outfit slot not found." });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /outfit-slots/:id failed");
    res.status(500).json({ error: "Failed to update outfit slot." });
  }
});

/**
 * DELETE /api/outfit-slots/:id
 *
 * Hard-deletes the slot. Use PATCH status:'archived' to soft-archive instead.
 */
router.delete("/outfit-slots/:id", requireAuth, async (req, res) => {
  const id = req.params["id"] as string;

  try {
    const [deleted] = await db
      .delete(outfitSlots)
      .where(and(eq(outfitSlots.id, id), eq(outfitSlots.userId, req.userId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Outfit slot not found." });
      return;
    }

    res.json({ id: deleted.id });
  } catch (err) {
    req.log.error({ err }, "DELETE /outfit-slots/:id failed");
    res.status(500).json({ error: "Failed to delete outfit slot." });
  }
});

/**
 * POST /api/outfit-slots/bulk
 *
 * Bulk-upserts draft slots from the AI suggest endpoint.
 * Body: { suggestions: Record<date, garmentId[]> }
 * Skips dates that already have a 'confirmed' slot.
 */
router.post("/outfit-slots/bulk", requireAuth, async (req, res) => {
  const { suggestions } = req.body as { suggestions?: Record<string, string[]> };

  if (!suggestions || typeof suggestions !== "object") {
    res.status(400).json({ error: "Body must have a 'suggestions' object." });
    return;
  }

  try {
    await ensureProfile(req.userId);

    // Fetch existing confirmed slots for these dates to avoid overwriting them
    const dates = Object.keys(suggestions);
    const existing = await db
      .select({ plannedDate: outfitSlots.plannedDate, status: outfitSlots.status })
      .from(outfitSlots)
      .where(and(eq(outfitSlots.userId, req.userId)));

    const confirmedDates = new Set(
      existing
        .filter((s) => s.status === "confirmed")
        .map((s) => s.plannedDate),
    );

    const toUpsert = dates
      .filter((d) => !confirmedDates.has(d) && (suggestions[d]?.length ?? 0) > 0)
      .map((d) => ({
        userId: req.userId,
        plannedDate: d,
        garmentIds: suggestions[d]!,
        status: "draft" as const,
      }));

    if (!toUpsert.length) {
      res.json([]);
      return;
    }

    const upserted = await db
      .insert(outfitSlots)
      .values(toUpsert)
      .onConflictDoUpdate({
        target: [outfitSlots.userId, outfitSlots.plannedDate],
        set: {
          garmentIds: sql`excluded.garment_ids`,
          status: sql`'draft'`,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.status(201).json(upserted);
  } catch (err) {
    req.log.error({ err }, "POST /outfit-slots/bulk failed");
    res.status(500).json({ error: "Failed to bulk-write outfit slots." });
  }
});

export default router;
