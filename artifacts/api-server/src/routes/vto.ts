import { Router } from "express";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const router = Router();
const VTO_SPACE = "https://yisol-idm-vton.hf.space";

/**
 * Upload a Buffer to the Gradio Space's /upload endpoint.
 * Returns the Gradio-internal path string.
 */
async function uploadToGradio(buf: Buffer, filename: string, mime: string): Promise<string> {
  const blob = new Blob([buf], { type: mime });
  const form = new FormData();
  form.append("files", blob, filename);

  const res = await fetch(`${VTO_SPACE}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Gradio upload failed: ${res.status}`);
  const paths = (await res.json()) as string[];
  const path = paths[0];
  if (!path) throw new Error("No path from Gradio upload");
  return path;
}

/**
 * POST /api/vto/tryon
 *
 * Proxy for the IDM-VTON Gradio Space — avoids CORS restrictions on the client.
 *
 * Body (JSON, up to 20 MB):
 *   modelImageUrl   — HTTPS URL of the user's model photo (Supabase storage)
 *   garmentBase64   — base64-encoded garment image (optionally with data URI prefix)
 *   garmentDescription — short text description of the garment
 *
 * Returns: { resultUrl: string }
 */
router.post("/vto/tryon", async (req, res) => {
  const { modelImageUrl, garmentBase64, garmentDescription } = req.body as {
    modelImageUrl?: string;
    garmentBase64?: string;
    garmentDescription?: string;
  };

  if (!modelImageUrl || !garmentBase64 || !garmentDescription) {
    return res
      .status(400)
      .json({ error: "Missing: modelImageUrl, garmentBase64, garmentDescription" });
  }

  const garmentTmp = join(tmpdir(), `fitweek_vto_garment_${randomUUID()}.jpg`);

  try {
    // 1. Decode garment base64 → temp file
    const raw = garmentBase64.replace(/^data:image\/\w+;base64,/, "");
    await writeFile(garmentTmp, Buffer.from(raw, "base64"));

    // 2. Upload garment to Gradio
    const garmentBuf = await readFile(garmentTmp);
    const garmentPath = await uploadToGradio(garmentBuf, "garment.jpg", "image/jpeg");

    // 3. Fetch model image from URL and upload to Gradio
    //    (Gradio cannot fetch external URLs directly — it needs files on its own server)
    let modelPath: string;
    try {
      const modelRes = await fetch(modelImageUrl);
      if (!modelRes.ok) throw new Error(`Model fetch failed: ${modelRes.status}`);
      const modelBuf = Buffer.from(await modelRes.arrayBuffer());
      modelPath = await uploadToGradio(modelBuf, "model.jpg", "image/jpeg");
    } catch (err) {
      req.log.error({ err }, "Failed to fetch/upload model image");
      return res.status(502).json({ error: "Could not fetch model image from the provided URL" });
    }

    // 4. Build FileData objects for model + garment
    const modelFileData = {
      path: modelPath,
      meta: { _type: "gradio.FileData" },
    };
    const garmentFileData = {
      path: garmentPath,
      meta: { _type: "gradio.FileData" },
    };

    // 5. POST /call/tryon to start the inference job
    const callRes = await fetch(`${VTO_SPACE}/call/tryon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          { background: modelFileData, layers: [], composite: null },
          garmentFileData,
          garmentDescription,
          true,  // is_checked — auto-masking
          true,  // is_checked_crop
          30,    // denoise_steps
          42,    // seed
        ],
      }),
    });

    if (!callRes.ok) {
      const body = await callRes.text();
      req.log.error({ status: callRes.status, body }, "Gradio /call/tryon failed");
      return res.status(502).json({ error: `Gradio call failed: ${callRes.status}` });
    }

    const { event_id } = (await callRes.json()) as { event_id: string };
    if (!event_id) return res.status(502).json({ error: "No event_id from Gradio" });

    // 6. Stream SSE from Gradio until event: complete
    const streamRes = await fetch(`${VTO_SPACE}/call/tryon/${event_id}`);
    if (!streamRes.ok) {
      return res
        .status(502)
        .json({ error: `Gradio stream failed: ${streamRes.status}` });
    }

    const reader = streamRes.body?.getReader();
    if (!reader) return res.status(502).json({ error: "No stream body from Gradio" });

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line === "event: complete") {
          const dataLine = lines[i + 1] ?? "";
          if (dataLine.startsWith("data: ")) {
            const data = JSON.parse(dataLine.slice(6)) as Array<{
              path: string;
              url?: string;
            }>;
            const result = data[0];
            const url =
              result?.url ||
              (result?.path ? `${VTO_SPACE}/file=${result.path}` : null);
            if (!url) return res.status(502).json({ error: "No URL in VTO result" });
            req.log.info({ url }, "VTO complete");
            return res.json({ resultUrl: url });
          }
        }

        if (line === "event: error") {
          const dataLine = lines[i + 1] ?? "";
          req.log.error({ gradioError: dataLine }, "Gradio VTO error event");
          return res.status(502).json({ error: `Gradio VTO error: ${dataLine}` });
        }
      }
    }

    return res.status(502).json({ error: "VTO stream ended without result" });
  } catch (err) {
    req.log.error({ err }, "VTO proxy error");
    return res.status(500).json({ error: "Internal VTO proxy error" });
  } finally {
    unlink(garmentTmp).catch(() => {});
  }
});

export default router;
