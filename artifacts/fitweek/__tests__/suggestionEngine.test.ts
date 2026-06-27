import {
  SuggestionEngine,
  GarmentRepository,
  ClassifierAdapter,
} from "../lib/suggestionEngine";
import { Garment } from "../lib/types";

class InMemoryGarmentRepository implements GarmentRepository {
  private store: Map<string, Garment> = new Map();

  constructor(initial: Garment[] = []) {
    for (const g of initial) this.store.set(g.id, g);
  }

  async getGarments() {
    return Array.from(this.store.values());
  }
  async saveGarment(g: Garment) {
    this.store.set(g.id, g);
  }
  async saveGarments(gs: Garment[]) {
    for (const g of gs) this.store.set(g.id, g);
  }
  async deleteGarment(id: string) {
    this.store.delete(id);
  }
}

class FakeClassifier implements ClassifierAdapter {
  async classifyImage(_uri: string) {
    return { category: "tops" as const, description: "A fake top" };
  }
}

function makeGarment(overrides: Partial<Garment> & { id: string }): Garment {
  return {
    imageUrl: "",
    category: "tops",
    color: "",
    tags: [],
    name: "Test",
    status: "active",
    wearCount: 0,
    lastWornAt: null,
    lastSkippedAt: null,
    skipUntil: null,
    deletedAt: null,
    createdAt: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

describe("SuggestionEngine — applyAction", () => {
  it("marks garment worn", async () => {
    const repo = new InMemoryGarmentRepository([
      makeGarment({ id: "g1", wearCount: 0 }),
    ]);
    const engine = new SuggestionEngine(repo, new FakeClassifier());
    await engine.applyAction("g1", "markWorn");
    const updated = (await repo.getGarments())[0]!;
    expect(updated.wearCount).toBe(1);
    expect(updated.lastWornAt).not.toBeNull();
  });

  it("sends garment to laundry", async () => {
    const repo = new InMemoryGarmentRepository([makeGarment({ id: "g1" })]);
    const engine = new SuggestionEngine(repo, new FakeClassifier());
    await engine.applyAction("g1", "sendToLaundry");
    const updated = (await repo.getGarments())[0]!;
    expect(updated.status).toBe("laundry");
  });
});
