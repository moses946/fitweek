/**
 * Virtual Try-On (VTO) — Issue 6
 *
 * Calls the api-server's /api/vto/tryon proxy (which in turn calls IDM-VTON on
 * HuggingFace Spaces). Routing through the server avoids browser CORS restrictions
 * and works identically on web and native.
 *
 * Garment priority: dresses/overalls → tops → bottoms → outerwear → shoes
 */

import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { API_BASE_URL } from "./config";
import { supabase, isSupabaseConfigured } from "./supabase";
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

// ── VTO proxy call ────────────────────────────────────────────────────────────

const VTO_TIMEOUT_MS = 120_000;

function getProxyUrl(): string {
  // On web, relative paths work; on native we need the full URL
  if (Platform.OS === "web") {
    return "/api/vto/tryon";
  }
  const apiBase = API_BASE_URL;
  return `${apiBase}/api/vto/tryon`;
}

function combineSignals(external: AbortSignal | undefined, internal: AbortSignal): AbortSignal {
  if (!external) return internal;
  const mc = new AbortController();
  const abort = () => mc.abort();
  external.addEventListener("abort", abort, { once: true });
  internal.addEventListener("abort", abort, { once: true });
  return mc.signal;
}

/**
 * Call the server-side VTO proxy.
 *
 * @param modelImageUrl   HTTPS URL of the user's model photo, OR null if base64 is used
 * @param modelBase64     Base64 of model photo when URL is a local file:// URI (iOS)
 * @param garmentBase64   Base64-encoded garment image
 * @param garmentDescription  Short text description of the garment
 * @param signal          Optional AbortSignal for cancellation
 *
 * Returns the result image URL.
 * Returns "" immediately if both model params are absent.
 * Throws VtoError(VTO_TIMEOUT) on timeout/abort.
 * Throws VtoError(VTO_ERROR) on any other failure.
 */
export async function callVTO(
  modelImageUrl: string | null,
  garmentBase64: string,
  garmentDescription: string,
  signal?: AbortSignal,
  modelBase64?: string,
): Promise<string> {
  if (!modelImageUrl && !modelBase64) {
    console.warn("[VTO:lib] No model image (URL or base64) — returning empty.");
    return "";
  }

  const proxyUrl = getProxyUrl();
  console.log("[VTO:lib] proxy URL:", proxyUrl);
  console.log("[VTO:lib] model source:", modelBase64 ? `base64 (${modelBase64.length} chars)` : `URL: ${modelImageUrl?.slice(0, 80)}…`);
  console.log("[VTO:lib] garmentBase64 length:", garmentBase64.length);
  console.log("[VTO:lib] garmentDescription:", garmentDescription);

  const internalController = new AbortController();
  const timer = setTimeout(() => {
    console.warn("[VTO:lib] Internal timeout fired after", VTO_TIMEOUT_MS, "ms — aborting.");
    internalController.abort();
  }, VTO_TIMEOUT_MS);
  const combined = combineSignals(signal, internalController.signal);

  const payload: Record<string, string> = { garmentBase64, garmentDescription };
  if (modelBase64) {
    payload.modelBase64 = modelBase64;
  } else if (modelImageUrl) {
    payload.modelImageUrl = modelImageUrl;
  }

  try {
    // Attach the Supabase session token so requireAuth passes on the server
    let authHeader = "";
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) authHeader = `Bearer ${token}`;
    }

    console.log("[VTO:lib] POSTing to proxy…");
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
      signal: combined,
    });

    console.log("[VTO:lib] Proxy response status:", res.status, res.statusText);

    if (!res.ok) {
      let errBody: { error?: string } = {};
      try {
        errBody = (await res.json()) as { error?: string };
      } catch {
        const text = await res.text().catch(() => "(unreadable body)");
        console.error("[VTO:lib] Non-JSON error body:", text);
      }
      console.warn("[VTO:lib] Proxy error payload:", errBody);
      throw new VtoError("VTO_ERROR", errBody.error ?? `Proxy returned ${res.status}`);
    }

    const body = (await res.json()) as { resultUrl?: string; resultBase64?: string };
    console.log("[VTO:lib] Proxy success body keys:", Object.keys(body));
    const { resultUrl, resultBase64 } = body;

    // Prefer base64 — write it to device cache so the image never expires
    if (resultBase64) {
      console.log("[VTO:lib] resultBase64 received, length:", resultBase64.length);
      try {
        const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
        const localUri = `${cacheDir}fitweek_vto_${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(localUri, resultBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log("[VTO:lib] VTO result saved locally:", localUri);
        return localUri;
      } catch (writeErr) {
        console.warn("[VTO:lib] Could not write VTO result to cache, falling back to URL:", writeErr);
      }
    }

    if (!resultUrl || typeof resultUrl !== "string") {
      console.error("[VTO:lib] resultUrl missing or not a string in response body:", body);
      throw new VtoError("VTO_ERROR", "No resultUrl in proxy response");
    }
    console.log("[VTO:lib] resultUrl (fallback):", resultUrl.slice(0, 100));
    return resultUrl;
  } catch (err) {
    if (err instanceof VtoError) throw err;
    const isAbort =
      (err instanceof Error && err.name === "AbortError") ||
      String(err).includes("AbortError");
    console.error("[VTO:lib] Fetch-level error (isAbort=" + isAbort + "):", err);
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
