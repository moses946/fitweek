/**
 * Virtual Try-On (VTO) — Issue 6
 *
 * Integrates with the IDM-VTON Gradio Space using the v4+ named-endpoint API:
 *   POST /call/tryon  → { event_id }
 *   GET  /call/tryon/{event_id}  → SSE stream → event: complete → data: [FileData, ...]
 *
 * Garment priority: dresses/overalls → tops → bottoms → outerwear → shoes
 */

import { Garment, GarmentCategory, OutfitSlot } from "./types";

// ── Error type ────────────────────────────────────────────────────────────────

export type VtoErrorCode = "VTO_TIMEOUT" | "VTO_ERROR";

export class VtoError extends Error {
  constructor(
    public readonly code: VtoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VtoError";
  }
}

// ── Hero garment selection ────────────────────────────────────────────────────

const HERO_PRIORITY: GarmentCategory[] = [
  "dresses",
  "tops",
  "bottoms",
  "outerwear",
  "shoes",
  "accessories",
  "other",
];

export function selectHeroGarment(garments: Garment[]): Garment | null {
  if (garments.length === 0) return null;
  for (const category of HERO_PRIORITY) {
    const found = garments.find((g) => g.category === category);
    if (found) return found;
  }
  return garments[0];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const VTO_SPACE_URL = "https://yisol-idm-vton.hf.space";
const VTO_TIMEOUT_MS = 120_000;

interface GradioFileData {
  path: string;
  url?: string;
  meta: { _type: string };
}

function makeFileData(path: string, url?: string): GradioFileData {
  return { path, ...(url ? { url } : {}), meta: { _type: "gradio.FileData" } };
}

/** Upload a local file URI to the Gradio Space and return its server-side path. */
async function uploadToGradio(uri: string, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  // React Native FormData accepts { uri, type, name } as a "file" entry
  form.append("files", { uri, type: "image/jpeg", name: "image.jpg" } as unknown as Blob);

  const res = await fetch(`${VTO_SPACE_URL}/upload`, {
    method: "POST",
    body: form,
    signal,
  });

  if (!res.ok) {
    throw new VtoError("VTO_ERROR", `Gradio upload failed: ${res.status}`);
  }

  const paths = (await res.json()) as string[];
  if (!paths?.[0]) throw new VtoError("VTO_ERROR", "No path returned from Gradio upload");
  return paths[0];
}

/**
 * For HTTP/HTTPS URIs, pass them directly as FileData (no upload required).
 * For local file:// URIs, upload first and use the returned server path.
 */
async function resolveFileData(uri: string, signal?: AbortSignal): Promise<GradioFileData> {
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return makeFileData(uri, uri);
  }
  const path = await uploadToGradio(uri, signal);
  return makeFileData(path);
}

/** Combine an optional external AbortSignal with the internal timeout signal. */
function combineSignals(external: AbortSignal | undefined, internal: AbortSignal): AbortSignal {
  if (!external) return internal;
  const mc = new AbortController();
  const abort = () => mc.abort();
  external.addEventListener("abort", abort, { once: true });
  internal.addEventListener("abort", abort, { once: true });
  return mc.signal;
}

// ── VTO API call ──────────────────────────────────────────────────────────────

/**
 * Calls the IDM-VTON Gradio Space named endpoint `/tryon`.
 *
 * Flow:
 *  1. Resolve image URIs → Gradio FileData (upload local files if needed)
 *  2. POST /call/tryon → { event_id }
 *  3. GET  /call/tryon/{event_id} → SSE stream → parse "event: complete"
 *
 * Returns the result image URL.
 * Throws VtoError(VTO_TIMEOUT) on timeout/abort.
 * Throws VtoError(VTO_ERROR) on HTTP or parse failure.
 * Returns "" immediately if modelImageUri is null.
 */
export async function callVTO(
  modelImageUri: string | null,
  garmentImageUri: string,
  garmentDescription: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!modelImageUri) return "";

  const internalController = new AbortController();
  const timer = setTimeout(() => internalController.abort(), VTO_TIMEOUT_MS);
  const combined = combineSignals(signal, internalController.signal);

  try {
    // 1. Resolve images to Gradio FileData
    const [modelData, garmentData] = await Promise.all([
      resolveFileData(modelImageUri, combined),
      resolveFileData(garmentImageUri, combined),
    ]);

    // 2. Initiate the VTO job
    const callRes = await fetch(`${VTO_SPACE_URL}/call/tryon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          { background: modelData, layers: [], composite: null },
          garmentData,
          garmentDescription,
          true, // is_checked — auto-masking
          true, // is_checked_crop
          30,   // denoise_steps
          42,   // seed
        ],
      }),
      signal: combined,
    });

    if (!callRes.ok) {
      throw new VtoError("VTO_ERROR", `Gradio call returned ${callRes.status}`);
    }

    const { event_id } = (await callRes.json()) as { event_id: string };
    if (!event_id) throw new VtoError("VTO_ERROR", "No event_id returned from Gradio");

    // 3. Stream SSE result
    const streamRes = await fetch(`${VTO_SPACE_URL}/call/tryon/${event_id}`, {
      signal: combined,
    });

    if (!streamRes.ok) {
      throw new VtoError("VTO_ERROR", `Gradio stream returned ${streamRes.status}`);
    }

    const reader = streamRes.body?.getReader();
    if (!reader) throw new VtoError("VTO_ERROR", "No response body from Gradio stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
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
              (result?.path ? `${VTO_SPACE_URL}/file=${result.path}` : undefined);
            if (!url) throw new VtoError("VTO_ERROR", "No URL in VTO result");
            return url;
          }
        }

        if (line === "event: error") {
          const dataLine = lines[i + 1] ?? "";
          throw new VtoError("VTO_ERROR", `Gradio returned an error: ${dataLine}`);
        }
      }
    }

    throw new VtoError("VTO_ERROR", "VTO stream ended without a result");
  } catch (err) {
    if (err instanceof VtoError) throw err;
    const isAbort =
      (err instanceof Error && err.name === "AbortError") ||
      String(err).includes("AbortError");
    throw new VtoError(
      isAbort ? "VTO_TIMEOUT" : "VTO_ERROR",
      isAbort ? "VTO request timed out" : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}

// ── Slot update ───────────────────────────────────────────────────────────────

export function saveVTOResult(
  slots: OutfitSlot[],
  slotId: string,
  vtoImageUrl: string,
): OutfitSlot[] {
  return slots.map((s) => (s.id === slotId ? { ...s, vtoImageUrl } : s));
}
