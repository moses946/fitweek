/**
 * Virtual Try-On (VTO) — Issue 6
 *
 * Integrates with the IDM-VTON Gradio Space to generate outfit try-on images.
 * Garment priority: dresses/overalls → tops → bottoms → outerwear → shoes
 *
 * Issue 6 TDD — Tests 1–10:
 *  Test 1:  selectHeroGarment([dress, jacket, trousers]) → dress
 *  Test 2:  selectHeroGarment([jacket, trousers])        → jacket (top priority)
 *  Test 3:  selectHeroGarment([trousers])               → trousers
 *  Test 4:  selectHeroGarment([])                       → null
 *  Test 5:  callVTO() success                           → URL returned
 *  Test 6:  callVTO() aborted                           → VtoError(VTO_TIMEOUT)
 *  Test 7:  callVTO() HTTP error                        → VtoError(VTO_ERROR)
 *  Test 8:  saveVTOResult(slotId, url)                  → slot.vtoImageUrl set
 *  Test 9:  callVTO() null modelImageUri                → "" without fetch
 *  Test 10: overalls use 'dresses' category             → highest priority
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

/**
 * Priority order: dresses (overalls) → tops → bottoms → outerwear → shoes →
 * accessories → other.
 */
const HERO_PRIORITY: GarmentCategory[] = [
  "dresses",
  "tops",
  "bottoms",
  "outerwear",
  "shoes",
  "accessories",
  "other",
];

/**
 * Tests 1–4, 10
 * Returns the highest-priority garment to use as the VTO hero.
 * Returns null when the array is empty.
 */
export function selectHeroGarment(garments: Garment[]): Garment | null {
  if (garments.length === 0) return null;
  for (const category of HERO_PRIORITY) {
    const found = garments.find((g) => g.category === category);
    if (found) return found;
  }
  return garments[0];
}

// ── VTO API call ──────────────────────────────────────────────────────────────

const VTO_SPACE_URL = "https://yisol-idm-vton.hf.space";
const VTO_TIMEOUT_MS = 90_000;

/**
 * Tests 5–7, 9
 * Calls the IDM-VTON Gradio Space `/run/predict` endpoint.
 * Returns the result image URL on success.
 * Throws VtoError(VTO_TIMEOUT) on abort / timeout.
 * Throws VtoError(VTO_ERROR) on HTTP or parse failure.
 *
 * Pass an AbortSignal to support user-initiated cancellation.
 * Null modelImageUri → returns "" immediately without any network call.
 */
export async function callVTO(
  modelImageUri: string | null,
  garmentImageUri: string,
  garmentDescription: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!modelImageUri) return "";

  const internalController = new AbortController();
  const timer = setTimeout(
    () => internalController.abort(),
    VTO_TIMEOUT_MS,
  );

  const fetchSignal = signal ?? internalController.signal;

  try {
    const res = await fetch(`${VTO_SPACE_URL}/run/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            background: { path: modelImageUri },
            layers: [],
            composite: null,
          },
          garmentImageUri,
          garmentDescription,
          true,
          true,
          30,
          42,
        ],
      }),
      signal: fetchSignal,
    });

    if (!res.ok) {
      throw new VtoError("VTO_ERROR", `Gradio returned status ${res.status}`);
    }

    const json = (await res.json()) as { data?: Array<{ url?: string } | string> };
    const first = json?.data?.[0];
    const resultUrl =
      first && typeof first === "object" && "url" in first
        ? first.url
        : typeof first === "string"
          ? first
          : undefined;

    if (!resultUrl) {
      throw new VtoError("VTO_ERROR", "No result URL in Gradio response");
    }
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

/**
 * Test 8
 * Pure function — returns a new slots array with vtoImageUrl set on the
 * matching slot. Does not write to storage; callers must persist the result.
 */
export function saveVTOResult(
  slots: OutfitSlot[],
  slotId: string,
  vtoImageUrl: string,
): OutfitSlot[] {
  return slots.map((s) => (s.id === slotId ? { ...s, vtoImageUrl } : s));
}
