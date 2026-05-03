/**
 * Virtual Try-On (VTO) — Issue 6
 *
 * Calls the api-server's /api/vto/tryon proxy (which in turn calls IDM-VTON on
 * HuggingFace Spaces). Routing through the server avoids browser CORS restrictions
 * and works identically on web and native.
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

// ── VTO proxy call ────────────────────────────────────────────────────────────

const VTO_TIMEOUT_MS = 120_000;

function getProxyUrl(): string {
  // On web, relative paths work; on native we need the full domain
  if (typeof window !== "undefined") {
    return "/api/vto/tryon";
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api/vto/tryon` : "http://localhost:8080/api/vto/tryon";
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
 * @param modelImageUrl   HTTPS URL of the user's model photo (from Supabase storage)
 * @param garmentBase64   Base64-encoded garment image (from expo-file-system)
 * @param garmentDescription  Short text description of the garment
 * @param signal          Optional AbortSignal for cancellation
 *
 * Returns the result image URL.
 * Returns "" immediately if modelImageUrl is null.
 * Throws VtoError(VTO_TIMEOUT) on timeout/abort.
 * Throws VtoError(VTO_ERROR) on any other failure.
 */
export async function callVTO(
  modelImageUrl: string | null,
  garmentBase64: string,
  garmentDescription: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!modelImageUrl) return "";

  const internalController = new AbortController();
  const timer = setTimeout(() => internalController.abort(), VTO_TIMEOUT_MS);
  const combined = combineSignals(signal, internalController.signal);

  try {
    const res = await fetch(getProxyUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelImageUrl, garmentBase64, garmentDescription }),
      signal: combined,
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new VtoError("VTO_ERROR", err.error ?? `Proxy returned ${res.status}`);
    }

    const { resultUrl } = (await res.json()) as { resultUrl?: string };
    if (!resultUrl) throw new VtoError("VTO_ERROR", "No resultUrl in proxy response");
    return resultUrl;
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
