import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { client } from "@gradio/client";
import { db, vtoResults, profiles } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function ensureProfile(userId: string) {
  await db.insert(profiles).values({ id: userId }).onConflictDoNothing();
}

/**
 * POST /api/vto/tryon
 *
 * Uses @gradio/client to call the IDM-VTON Gradio Space.
 * Writes a vto_results row (status: pending → ready | failed).
 *
 * Body (JSON, up to 20 MB):
 *   modelImageUrl      — HTTPS URL of the user's model photo (Supabase storage)
 *   modelBase64        — base64-encoded model image (with optional data URI prefix)
 *   garmentBase64      — base64-encoded garment image (with optional data URI prefix)
 *   garmentDescription — short text description of the garment
 *   garmentId          — optional UUID of the garment being tried on (for history)
 *   outfitSlotId       — optional UUID of the outfit slot (for history)
 *
 * Returns: { id: string, resultUrl: string, resultBase64: string, status: 'ready' | 'failed' }
 */
router.post("/vto/tryon", requireAuth, async (req, res) => {
  const {
    modelImageUrl,
    modelBase64,
    garmentBase64,
    garmentDescription,
    garmentId,
    outfitSlotId,
  } = req.body as {
    modelImageUrl?: string;
    modelBase64?: string;
    garmentBase64?: string;
    garmentDescription?: string;
    garmentId?: string;
    outfitSlotId?: string;
  };

  if (!modelImageUrl && !modelBase64) {
    return res.status(400).json({ error: "Missing: modelImageUrl or modelBase64" });
  }
  if (!garmentBase64 || !garmentDescription) {
    return res.status(400).json({ error: "Missing: garmentBase64, garmentDescription" });
  }

  // ── 1. Seed profile + insert a pending vto_results row ───────────────────
  await ensureProfile(req.userId);

  const [pendingRow] = await db
    .insert(vtoResults)
    .values({
      userId: req.userId,
      garmentId: garmentId ?? null,
      outfitSlotId: outfitSlotId ?? null,
      status: "pending",
    })
    .returning();

  req.log.info({ vtoId: pendingRow!.id }, "VTO row created (pending)");

  try {
    // ── 2. Decode garment to Buffer ─────────────────────────────────────────
    const rawGarment = garmentBase64.replace(/^data:image\/\w+;base64,/, "");
    const garmentBuf = Buffer.from(rawGarment, "base64");
    req.log.info({ bytes: garmentBuf.byteLength }, "Garment decoded");

    // ── 3. Obtain model image as Buffer ─────────────────────────────────────
    let modelBuf: Buffer;
    if (modelBase64) {
      const rawModel = modelBase64.replace(/^data:image\/\w+;base64,/, "");
      modelBuf = Buffer.from(rawModel, "base64");
      req.log.info({ bytes: modelBuf.byteLength }, "Model image from base64");
    } else {
      const modelRes = await fetch(modelImageUrl!);
      if (!modelRes.ok) throw new Error(`Model fetch failed: ${modelRes.status}`);
      modelBuf = Buffer.from(await modelRes.arrayBuffer());
      req.log.info({ bytes: modelBuf.byteLength, modelImageUrl }, "Model image from URL");
    }

    // ── 4. Call IDM-VTON ────────────────────────────────────────────────────
    req.log.info("Calling IDM-VTON Gradio Space via @gradio/client");
    const app = await client("yisol/IDM-VTON");

    const result = (await app.predict("/tryon", [
      {
        background: new Blob([new Uint8Array(modelBuf)], { type: "image/jpeg" }),
        layers: [],
        composite: null,
      },
      new Blob([new Uint8Array(garmentBuf)], { type: "image/jpeg" }),
      garmentDescription,
      true,
      true,
      30,
      42,
    ])) as { data: unknown[] };

    req.log.info(
      { resultData: JSON.stringify(result.data).slice(0, 300) },
      "Gradio raw result",
    );

    // ── 5. Extract output URL ───────────────────────────────────────────────
    const rawOutput = result.data[0];
    let outputUrl: string | null = null;
    if (typeof rawOutput === "string") {
      outputUrl = rawOutput;
    } else if (rawOutput && typeof rawOutput === "object" && "url" in rawOutput) {
      outputUrl = (rawOutput as { url: string }).url;
    }

    if (!outputUrl) {
      throw new Error("Gradio Space returned empty output");
    }

    req.log.info({ outputUrl }, "VTO complete — downloading result image");

    // ── 6. Download result and base64-encode ────────────────────────────────
    let resultBase64: string | null = null;
    try {
      const resultImageRes = await fetch(outputUrl);
      if (resultImageRes.ok) {
        const resultBuf = Buffer.from(await resultImageRes.arrayBuffer());
        resultBase64 = resultBuf.toString("base64");
        req.log.info({ bytes: resultBuf.byteLength }, "VTO result downloaded");
      }
    } catch (err) {
      req.log.warn({ err }, "VTO result download failed — returning URL only");
    }

    // ── 7. Update vto_results row → ready ──────────────────────────────────
    const [readyRow] = await db
      .update(vtoResults)
      .set({
        status: "ready",
        resultUrl: outputUrl,
        // storagePath is left null here — set this if you upload to Supabase Storage
        updatedAt: new Date(),
      })
      .where(
        and(eq(vtoResults.id, pendingRow!.id), eq(vtoResults.userId, req.userId)),
      )
      .returning();

    return res.json({
      id: readyRow!.id,
      resultUrl: outputUrl,
      resultBase64,
      status: "ready",
    });
  } catch (err) {
    req.log.error({ err }, "VTO proxy error");

    // Update vto_results row → failed
    await db
      .update(vtoResults)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Unknown VTO error",
        updatedAt: new Date(),
      })
      .where(
        and(eq(vtoResults.id, pendingRow!.id), eq(vtoResults.userId, req.userId)),
      );

    return res.status(500).json({
      id: pendingRow!.id,
      status: "failed",
      error: err instanceof Error ? err.message : "Internal VTO proxy error",
    });
  }
});

/**
 * GET /api/vto/history
 *
 * Returns all 'ready' VTO results for the authenticated user, newest first.
 */
router.get("/vto/history", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(vtoResults)
      .where(and(eq(vtoResults.userId, req.userId), eq(vtoResults.status, "ready")))
      .orderBy(vtoResults.createdAt);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "GET /vto/history failed");
    res.status(500).json({ error: "Failed to load VTO history." });
  }
});

export default router;
