/**
 * Issue 6 TDD — Virtual Try-On (VTO)
 *
 * Test 1:  selectHeroGarment([dress, jacket, trousers]) → dress
 * Test 2:  selectHeroGarment([jacket, trousers])        → jacket
 * Test 3:  selectHeroGarment([trousers])               → trousers (bottoms)
 * Test 4:  selectHeroGarment([])                       → null
 * Test 5:  callVTO() success                           → result URL returned
 * Test 6:  callVTO() aborted via signal                → VtoError(VTO_TIMEOUT)
 * Test 7:  callVTO() proxy HTTP 500                    → VtoError(VTO_ERROR)
 * Test 8:  saveVTOResult(slotId, url)                  → slot.vtoImageUrl updated
 * Test 9:  callVTO() with null modelImageUri           → returns "" without fetching
 * Test 10: selectHeroGarment — overalls map to dresses category (highest priority)
 */

import { Garment, OutfitSlot } from "../lib/types";
import {
  selectHeroGarment,
  callVTO,
  saveVTOResult,
  VtoError,
} from "../lib/vto";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGarment(overrides: Partial<Garment> = {}): Garment {
  return {
    id: "g1",
    imageUri: "https://example.com/g1.jpg",
    category: "tops",
    color: "white",
    tags: [],
    name: "White Shirt",
    status: "clean",
    wearCount: 0,
    lastWornAt: null,
    lastSkippedAt: null,
    skipUntil: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    aiDescription: null,
    ...overrides,
  };
}

function makeSlot(overrides: Partial<OutfitSlot> = {}): OutfitSlot {
  return {
    id: "s1",
    date: "2025-05-05",
    garmentIds: ["g1"],
    status: "confirmed",
    name: "Monday Outfit",
    createdAt: new Date().toISOString(),
    vtoImageUrl: null,
    ...overrides,
  };
}

// ── selectHeroGarment ─────────────────────────────────────────────────────────

describe("selectHeroGarment", () => {
  test("Test 1: returns dress when dress, jacket, and trousers are all present", () => {
    const garments = [
      makeGarment({ id: "g1", category: "tops" }),
      makeGarment({ id: "g2", category: "dresses" }),
      makeGarment({ id: "g3", category: "bottoms" }),
    ];
    const hero = selectHeroGarment(garments);
    expect(hero?.id).toBe("g2");
    expect(hero?.category).toBe("dresses");
  });

  test("Test 2: returns top when no dress present", () => {
    const garments = [
      makeGarment({ id: "g1", category: "outerwear", name: "Jacket" }),
      makeGarment({ id: "g2", category: "tops", name: "T-shirt" }),
      makeGarment({ id: "g3", category: "bottoms", name: "Trousers" }),
    ];
    const hero = selectHeroGarment(garments);
    expect(hero?.category).toBe("tops");
  });

  test("Test 3: returns bottoms when only trousers present", () => {
    const garments = [makeGarment({ id: "g1", category: "bottoms" })];
    expect(selectHeroGarment(garments)?.category).toBe("bottoms");
  });

  test("Test 4: returns null for an empty array", () => {
    expect(selectHeroGarment([])).toBeNull();
  });

  test("Test 10: overalls map to 'dresses' category — selected over tops", () => {
    const garments = [
      makeGarment({ id: "g1", category: "dresses", name: "Overalls" }),
      makeGarment({ id: "g2", category: "tops", name: "T-shirt" }),
    ];
    const hero = selectHeroGarment(garments);
    expect(hero?.name).toBe("Overalls");
    expect(hero?.category).toBe("dresses");
  });
});

// ── callVTO ───────────────────────────────────────────────────────────────────

describe("callVTO", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test("Test 5: success — single proxy call returns resultUrl", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ resultUrl: "https://hf.space/result/try-on.jpg" }),
    } as unknown as Response);

    const url = await callVTO(
      "https://example.com/model.jpg",
      "base64garmentdata==",
      "navy blue dress",
    );
    expect(url).toBe("https://hf.space/result/try-on.jpg");

    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toContain("/api/vto/tryon");
    expect(JSON.parse(call[1].body)).toMatchObject({
      modelImageUrl: "https://example.com/model.jpg",
      garmentBase64: "base64garmentdata==",
      garmentDescription: "navy blue dress",
    });
  });

  test("Test 6: abort signal fires — throws VtoError with code VTO_TIMEOUT", async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(
        (_url: unknown, opts: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.signal?.addEventListener("abort", () => {
              reject(
                Object.assign(new Error("The operation was aborted."), {
                  name: "AbortError",
                }),
              );
            });
          }),
      );

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);

    await expect(
      callVTO(
        "https://example.com/model.jpg",
        "base64garmentdata==",
        "navy blue dress",
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "VTO_TIMEOUT" });
  });

  test("Test 7: proxy HTTP 500 — throws VtoError with code VTO_ERROR", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal VTO proxy error" }),
    } as unknown as Response);

    await expect(
      callVTO(
        "https://example.com/model.jpg",
        "base64garmentdata==",
        "dress",
      ),
    ).rejects.toMatchObject({ code: "VTO_ERROR" });
  });

  test("Test 9: null modelImageUri — returns empty string without calling fetch", async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    const result = await callVTO(null, "base64garmentdata==", "dress");
    expect(result).toBe("");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── saveVTOResult ─────────────────────────────────────────────────────────────

describe("saveVTOResult", () => {
  test("Test 8: sets vtoImageUrl on the matching slot; leaves others unchanged", () => {
    const slots = [
      makeSlot({ id: "s1", vtoImageUrl: null }),
      makeSlot({ id: "s2", vtoImageUrl: null }),
    ];
    const updated = saveVTOResult(slots, "s1", "https://example.com/result.jpg");
    expect(updated.find((s) => s.id === "s1")?.vtoImageUrl).toBe(
      "https://example.com/result.jpg",
    );
    expect(updated.find((s) => s.id === "s2")?.vtoImageUrl).toBeNull();
  });
});
