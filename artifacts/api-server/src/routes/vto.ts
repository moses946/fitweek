import { Router } from "express";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { client } from "@gradio/client";

const router = Router();

/**
 * POST /api/vto/tryon
 *
 * Uses the @gradio/client to call the IDM-VTON Gradio Space.
 * This avoids CORS issues and uses the official client library.
 *
 * Body (JSON, up to 20 MB):
 *   modelImageUrl   — HTTPS URL of the user's model photo (Supabase storage)
 *   modelBase64     — base64-encoded model image (with data URI prefix)
 *   garmentBase64   — base64-encoded garment image (with data URI prefix)
 *   garmentDescription — short text description of the garment
 *
 * Returns: { resultUrl: string, resultBase64: string }
 */
router.post("/vto/tryon", async (req, res) => {
  const { modelImageUrl, modelBase64, garmentBase64, garmentDescription } =
    req.body as {
      modelImageUrl?: string;
      modelBase64?: string;
      garmentBase64?: string;
      garmentDescription?: string;
    };

  if (!modelImageUrl && !modelBase64) {
    return res
      .status(400)
      .json({ error: "Missing: modelImageUrl or modelBase64" });
  }
  if (!garmentBase64 || !garmentDescription) {
    return res
      .status(400)
      .json({ error: "Missing: garmentBase64, garmentDescription" });
  }

  const garmentTmp = join(tmpdir(), `fitweek_vto_garment_${randomUUID()}.jpg`);
  const modelTmp = join(tmpdir(), `fitweek_vto_model_${randomUUID()}.jpg`);

  try {
    // 1. Decode and write garment to temp file
    const rawGarment = garmentBase64.replace(
      /^data:image\/\w+;base64,/,
      ""
    );
    const garmentBuf = Buffer.from(rawGarment, "base64");
    await writeFile(garmentTmp, garmentBuf);
    req.log.info({ bytes: garmentBuf.byteLength }, "Garment decoded to temp file");

    // 2. Obtain model image
    let modelBuf: Buffer;
    if (modelBase64) {
      const rawModel = modelBase64.replace(/^data:image\/\w+;base64,/, "");
      modelBuf = Buffer.from(rawModel, "base64");
      req.log.info({ bytes: modelBuf.byteLength }, "Model image from base64");
    } else {
      const modelRes = await fetch(modelImageUrl!);
      if (!modelRes.ok)
        throw new Error(`Model fetch failed: ${modelRes.status}`);
      modelBuf = Buffer.from(await modelRes.arrayBuffer());
      req.log.info(
        { bytes: modelBuf.byteLength, modelImageUrl },
        "Model image from URL"
      );
    }
    await writeFile(modelTmp, modelBuf);

    // 3. Call Gradio Space using @gradio/client
    req.log.info(
      "Calling IDM-VTON Gradio Space via @gradio/client"
    );

    const app = await client("yisol/IDM-VTON");

    const result = (await app.predict("/tryon", [
      {
        background: {
          path: modelTmp,
          orig_name: "model.jpg",
          is_stream: false,
          meta: { _type: "gradio.FileData" },
        },
        layers: [],
        composite: null,
      },
      new Blob([garmentBuf], { type: "image/jpeg" }),
      garmentDescription,
      true,
      true,
      30,
      42,
    ])) as { data: [string, string] };

    const [outputUrl, maskedUrl] = result.data;

    if (!outputUrl) {
      throw new Error("Gradio Space returned empty output");
    }

    req.log.info(
      { outputUrl },
      "VTO complete — downloading result image"
    );

    // 4. Download result immediately
    let resultBase64: string | null = null;
    try {
      const resultImageRes = await fetch(outputUrl);
      if (resultImageRes.ok) {
        const resultBuf = Buffer.from(
          await resultImageRes.arrayBuffer()
        );
        resultBase64 = resultBuf.toString("base64");
        req.log.info({ bytes: resultBuf.byteLength }, "VTO result downloaded");
      } else {
        req.log.warn(
          { status: resultImageRes.status },
          "Could not download VTO result — returning URL only"
        );
      }
    } catch (err) {
      req.log.warn({ err }, "VTO result download failed — returning URL only");
    }

    return res.json({ resultUrl: outputUrl, resultBase64 });
  } catch (err) {
    req.log.error({ err }, "VTO proxy error");
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Internal VTO proxy error",
    });
  } finally {
    unlink(garmentTmp).catch(() => {});
    unlink(modelTmp).catch(() => {});
  }
});

export default router;
