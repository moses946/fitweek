import { Router } from "express";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const router = Router();
const VTO_SPACE = "https://yisol-idm-vton.hf.space";

const GRADIO_DATA_NULL = "GRADIO_DATA_NULL";

function isDataNullError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.startsWith(GRADIO_DATA_NULL) || msg.includes("stream ended without a result");
}

/**
 * Try Gradio 4 upload path first (/gradio_api/upload), then fall back to v3 (/upload).
 */
async function uploadToGradio(buf: Buffer, filename: string, mime: string): Promise<string> {
  const blob = new Blob([new Uint8Array(buf)], { type: mime });
  const form = new FormData();
  form.append("files", blob, filename);

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
 *
 * Throws an error starting with GRADIO_DATA_NULL when the Space returns
 * `data: null` — which means it is cold-starting or at capacity.
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
            const raw = dataLine.slice(6).trim();

            // "data: null" — Space is cold-starting or at capacity.
            // Throw a typed sentinel so the caller can retry with backoff.
            if (raw === "null" || raw === "") {
              errorMsg = `${GRADIO_DATA_NULL}: Space returned null — cold-start or at capacity`;
              break;
            }

            try {
              const parsed = JSON.parse(raw);

              // Guard against a null or non-array/non-object parse result
              if (parsed === null || parsed === undefined) {
                errorMsg = `${GRADIO_DATA_NULL}: Parsed data is null`;
                break;
              }

              const items: Array<{ path?: string; url?: string }> = Array.isArray(parsed)
                ? parsed
                : [parsed];
              const first = items[0];

              if (!first) {
                errorMsg = `${GRADIO_DATA_NULL}: Empty result array from Space`;
                break;
              }

              resultUrl =
                first?.url ??
                (first?.path ? `${VTO_SPACE}/file=${first.path}` : null);

              if (!resultUrl) {
                errorMsg = "VTO result item had no url or path";
              }
            } catch {
              errorMsg = "Failed to parse VTO result JSON";
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

    // Propagate typed sentinel immediately so the route can retry
    if (errorMsg?.startsWith(GRADIO_DATA_NULL)) {
      throw new Error(errorMsg);
    }

    if (errorMsg) throw new Error(errorMsg);
    // No result on this endpoint — try the next one
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
        const rawModel = modelBase64.replace(/^data:image\/\w+;base64,/, "");
        modelBuf = Buffer.from(rawModel, "base64");
        req.log.info({ bytes: modelBuf.byteLength }, "Model image from base64");
      } else {
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

    // 4. Build Gradio payload
    const modelFileData = makeFileData(modelPath);
    const garmentFileData = makeFileData(garmentPath);

    const payload = [
      { background: modelFileData, layers: [], composite: null },
      garmentFileData,
      garmentDescription,
      true,   // is_checked — auto-masking
      true,   // is_checked_crop
      30,     // denoise_steps
      42,     // seed
    ];

    // 5. Retry up to 3 times when the Space is cold/null (30 s between attempts)
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 30_000;
    let resultUrl = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        resultUrl = await callTryon(payload);
        break; // success
      } catch (err) {
        if (isDataNullError(err) && attempt < MAX_ATTEMPTS) {
          req.log.warn(
            { attempt, maxAttempts: MAX_ATTEMPTS },
            `Gradio data:null — Space is cold. Waiting ${RETRY_DELAY_MS / 1000}s before retry ${attempt + 1}/${MAX_ATTEMPTS}`,
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        throw err; // non-retriable or exhausted
      }
    }

    req.log.info({ resultUrl }, "VTO complete — downloading result image");

    // 6. Download result immediately so the client never depends on an expiring Gradio URL
    let resultBase64: string | null = null;
    try {
      const resultImageRes = await fetch(resultUrl);
      if (resultImageRes.ok) {
        const resultBuf = Buffer.from(await resultImageRes.arrayBuffer());
        resultBase64 = resultBuf.toString("base64");
        req.log.info({ bytes: resultBuf.byteLength }, "VTO result image downloaded");
      } else {
        req.log.warn({ status: resultImageRes.status }, "Could not download VTO result — returning URL only");
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
