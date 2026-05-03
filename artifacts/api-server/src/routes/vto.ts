import { Router } from "express";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const router = Router();
const VTO_SPACE = "https://yisol-idm-vton.hf.space";

/**
 * Try Gradio 4 upload path first (/gradio_api/upload), then fall back to v3 (/upload).
 */
async function uploadToGradio(buf: Buffer, filename: string, mime: string): Promise<string> {
  const blob = new Blob([new Uint8Array(buf)], { type: mime });
  const form = new FormData();
  form.append("files", blob, filename);

  // Try Gradio 4 API first
  for (const path of ["/gradio_api/upload", "/upload"]) {
    try {
      const res = await fetch(`${VTO_SPACE}${path}`, { method: "POST", body: form });
      if (!res.ok) continue;
      const data = (await res.json()) as string[] | { files: string[] };
      const files = Array.isArray(data) ? data : data.files;
      const filePath = files[0];
      if (filePath) return filePath;
    } catch {
      // try next path
    }
  }
  throw new Error("Gradio upload failed on all attempted endpoints");
}

function makeFileData(path: string) {
  return {
    path,
    orig_name: path.split("/").pop() ?? "file",
    is_stream: false,
    meta: { _type: "gradio.FileData" },
  };
}

/**
 * Call the Gradio Space to run the tryon function.
 * Tries Gradio 4 (/gradio_api/call/tryon) then Gradio 3 (/call/tryon).
 */
async function callTryon(data: unknown[]): Promise<string> {
  const endpoints = ["/gradio_api/call/tryon", "/call/tryon"];

  for (const endpoint of endpoints) {
    let eventId: string | undefined;

    try {
      const callRes = await fetch(`${VTO_SPACE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });

      if (!callRes.ok) continue;

      const callJson = (await callRes.json()) as { event_id?: string };
      eventId = callJson.event_id;
      if (!eventId) continue;
    } catch {
      continue;
    }

    // Poll the stream endpoint
    const streamPath = `${VTO_SPACE}${endpoint}/${eventId}`;
    const streamRes = await fetch(streamPath);
    if (!streamRes.ok) continue;

    const reader = streamRes.body?.getReader();
    if (!reader) continue;

    const decoder = new TextDecoder();
    let buffer = "";
    let resultUrl: string | null = null;
    let errorMsg: string | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim();

        if (line === "event: complete") {
          const dataLine = lines[i + 1] ?? "";
          if (dataLine.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(dataLine.slice(6));
              const items: Array<{ path?: string; url?: string }> = Array.isArray(parsed)
                ? parsed
                : [parsed];
              const first = items[0];
              resultUrl =
                first?.url ??
                (first?.path ? `${VTO_SPACE}/file=${first.path}` : null);
            } catch {
              errorMsg = "Failed to parse VTO result";
            }
          }
          break;
        }

        if (line === "event: error") {
          const dataLine = lines[i + 1] ?? "";
          errorMsg = `Gradio error: ${dataLine}`;
          break;
        }
      }

      if (resultUrl || errorMsg) break;
    }

    if (resultUrl) return resultUrl;
    if (errorMsg) throw new Error(errorMsg);
    // If we get here without a result, try the next endpoint
  }

  throw new Error("VTO stream ended without a result on all endpoints");
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

    // 3. Fetch model image and upload to Gradio
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

    // 4. Build payload — image editor format for model, FileData for garment
    const modelFileData = makeFileData(modelPath);
    const garmentFileData = makeFileData(garmentPath);

    const payload = [
      // Gradio ImageEditor component: { background, layers, composite }
      { background: modelFileData, layers: [], composite: null },
      garmentFileData,        // garment image
      garmentDescription,     // text description
      true,                   // is_checked — auto-masking
      true,                   // is_checked_crop
      30,                     // denoise_steps
      42,                     // seed
    ];

    const resultUrl = await callTryon(payload);
    req.log.info({ resultUrl }, "VTO complete");
    return res.json({ resultUrl });
  } catch (err) {
    req.log.error({ err }, "VTO proxy error");
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Internal VTO proxy error",
    });
  } finally {
    unlink(garmentTmp).catch(() => {});
  }
});

export default router;
