import { VTOOrchestrator, selectHeroGarment, VtoError } from "../lib/vtoOrchestrator";
import { createInMemoryStorageAdapter } from "../lib/storage";

describe("VTOOrchestrator", () => {
  let storage: any;
  let orchestrator: VTOOrchestrator;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    storage = createInMemoryStorageAdapter();
    mockFetch = jest.fn();
    orchestrator = new VTOOrchestrator({ fetch: mockFetch as any }, storage);
  });

  describe("selectHeroGarment", () => {
    it("selects dresses over tops", () => {
      const garments = [
        { id: "1", category: "tops" },
        { id: "2", category: "dresses" },
      ] as any[];
      expect(selectHeroGarment(garments)?.id).toBe("2");
    });
  });

  describe("startVTO", () => {
    it("returns localUri if base64 is provided and cached", async () => {
      mockFetch.mockResolvedValue({ resultBase64: "dummy-base64" });
      
      const res = await orchestrator.startVTO({
        modelImageUrl: "http://model",
        garmentBase64: "g-base64",
        garmentDescription: "desc"
      });

      expect(res.type).toBe("localUri");
      if (res.type === "localUri") {
        const cached = await orchestrator.getCachedResult(res.uri);
        expect(cached).toBe("dummy-base64");
      }
    });

    it("returns remoteUrl if base64 is missing", async () => {
      mockFetch.mockResolvedValue({ resultUrl: "http://result" });
      
      const res = await orchestrator.startVTO({
        modelImageUrl: "http://model",
        garmentBase64: "g-base64",
        garmentDescription: "desc"
      });

      expect(res.type).toBe("remoteUrl");
      if (res.type === "remoteUrl") {
        expect(res.url).toBe("http://result");
      }
    });

    it("retries on failure if configured", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network fail"))
               .mockResolvedValueOnce({ resultUrl: "http://result" });

      const res = await orchestrator.startVTO({
        modelImageUrl: "http://model",
        garmentBase64: "g",
        garmentDescription: "d"
      }, { retries: 1 });

      expect(res.type).toBe("remoteUrl");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("returns error on abort", async () => {
      const controller = new AbortController();
      controller.abort();

      const res = await orchestrator.startVTO({
        modelImageUrl: "http://model",
        garmentBase64: "g",
        garmentDescription: "d"
      }, { signal: controller.signal });

      expect(res.type).toBe("error");
      if (res.type === "error") {
        expect(res.error.code).toBe("VTO_TIMEOUT");
      }
    });
  });
});
