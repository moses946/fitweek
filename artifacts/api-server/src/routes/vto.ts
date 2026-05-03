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
  const { modelImageUrl, modelBase64, garmentBase64, garmentDescription } = req.body as {
    modelImageUrl?: string;
    modelBase64?: string;
    garmentBase64?: string;
    garmentDescription?: string;
  };

  // Need either a model URL or base64-encoded model image
  if (!modelImageUrl && !modelBase64) {
    return res.status(400).json({ error: "Missing: modelImageUrl or modelBase64" });
  }
  if (!garmentBase64 || !garmentDescription) {
    return res.status(400).json({ error: "Missing: garmentBase64, garmentDescription" });
  }

  const garmentTmp = join(tmpdir(), `fitweek_vto_garment_${randomUUID()}.jpg`);

  try {
    // 1. Decode garment base64 → temp file
    const raw = garmentBase64.replace(/^data:image\/\w+;base64,/, "");
    await writeFile(garmentTmp, Buffer.from(raw, "base64"));

    // 2. Upload garment to Gradio
    const garmentBuf = await readFile(garmentTmp);
    const garmentPath = await uploadToGradio(garmentBuf, "garment.jpg", "image/jpeg");

    // 3. Obtain model image buffer — from base64 (iOS local file) or remote URL
    let modelPath: string;
    try {
      let modelBuf: Buffer;
      if (modelBase64) {
        // Client sent model as base64 (local file URI case — e.g. iOS Expo Go)
        const rawModel = modelBase64.replace(/^data:image\/\w+;base64,/, "");
        modelBuf = Buffer.from(rawModel, "base64");
        req.log.info({ bytes: modelBuf.byteLength }, "Model image from base64");
      } else {
        // Fetch model from remote HTTPS URL (Supabase storage)
        const modelRes = await fetch(modelImageUrl!);
        if (!modelRes.ok) throw new Error(`Model fetch failed: ${modelRes.status}`);
        modelBuf = Buffer.from(await modelRes.arrayBuffer());
        req.log.info({ bytes: modelBuf.byteLength, modelImageUrl }, "Model image from URL");
      }
      modelPath = await uploadToGradio(modelBuf, "model.jpg", "image/jpeg");
    } catch (err) {
      req.log.error({ err }, "Failed to obtain/upload model image");
      return res.status(502).json({ error: "Could not process model image" });
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

    // Retry once if Gradio returns data: null (Space is cold-starting or at capacity)
    let resultUrl: string;
    try {
      resultUrl = await callTryon(payload);
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      if (msg.includes("data: null")) {
        req.log.warn({ msg }, "Gradio returned data: null — waiting 30s and retrying");
        await new Promise((r) => setTimeout(r, 30_000));
        resultUrl = await callTryon(payload);
      } else {
        throw firstErr;
      }
    }
    req.log.info({ resultUrl }, "VTO complete — downloading result image");

    // Download the result image immediately so the client never depends on
    // a Gradio temp-file URL (which expires within minutes).
    let resultBase64: string | null = null;
    try {
      const resultImageRes = await fetch(resultUrl);
      if (resultImageRes.ok) {
        const resultBuf = Buffer.from(await resultImageRes.arrayBuffer());
        resultBase64 = resultBuf.toString("base64");
        req.log.info({ bytes: resultBuf.byteLength }, "VTO result image downloaded");
      } else {
        req.log.warn({ status: resultImageRes.status }, "Could not download VTO result image — returning URL only");
      }
    } catch (err) {
      req.log.warn({ err }, "VTO result download failed — returning URL only");
    }

    return res.json({ resultUrl, resultBase64 });
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
