import { OutfitSlotStore } from "../lib/outfitSlotStore";
import { createInMemoryStorageAdapter } from "../lib/storage";
import { createInMemorySchedulerAdapter } from "../lib/scheduler";
import { Garment } from "../lib/types";

describe("OutfitSlotStore", () => {
  let store: OutfitSlotStore;
  let storage: any;
  let scheduler: any;

  beforeEach(() => {
    storage = createInMemoryStorageAdapter();
    scheduler = createInMemorySchedulerAdapter();
    store = new OutfitSlotStore(storage, scheduler);
  });

  const mockGarments: Garment[] = [
    { id: "g1", category: "tops", status: "clean", imageUrl: "", subcategory: "", color: "", brand: "", isFavorite: false, addedAt: "" },
    { id: "g2", category: "bottoms", status: "clean", imageUrl: "", subcategory: "", color: "", brand: "", isFavorite: false, addedAt: "" },
  ];

  it("initialises and cleans up expired drafts", async () => {
    // Set up a draft that is 48 hours old
    const oldDraft = {
      id: "old-1",
      date: "2026-05-01",
      garmentIds: [],
      status: "draft",
      name: null,
      createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    };
    await storage.set("@fitweek/outfit_slots_v1", [oldDraft]);

    await store.init();
    expect(store.getState().slots).toHaveLength(0);
  });

  it("schedules sunday planner on init", async () => {
    await store.init();
    const scheduled = await scheduler.list("planner");
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].id).toBe("sunday-planner-reminder");
  });

  it("creates a draft slot", async () => {
    await store.init();
    const draft = await store.createDraft("2026-05-05");
    expect(draft.id).toBeDefined();
    expect(draft.date).toBe("2026-05-05");
    expect(draft.status).toBe("draft");
    expect(store.getState().slots).toHaveLength(1);
  });

  it("adds and removes garments", async () => {
    await store.init();
    const draft = await store.createDraft("2026-05-05");
    
    await store.addGarment(draft.id, "g1");
    expect(store.getSlotForDate("2026-05-05")?.garmentIds).toEqual(["g1"]);
    
    await store.removeGarment(draft.id, "g1");
    expect(store.getSlotForDate("2026-05-05")?.garmentIds).toEqual([]);
  });

  it("confirms a slot and auto-names it", async () => {
    await store.init();
    const draft = await store.createDraft("2026-05-05");
    await store.addGarment(draft.id, "g1");
    await store.addGarment(draft.id, "g2");
    
    await store.confirmSlot(draft.id, mockGarments);
    
    const slot = store.getSlotForDate("2026-05-05");
    expect(slot?.status).toBe("confirmed");
    expect(slot?.name).toBe("Top + Trousers");
  });

  it("bulk imports draft suggestions", async () => {
    await store.init();
    await store.bulkImport({
      "2026-05-06": ["g1"],
      "2026-05-07": ["g2"],
    });

    expect(store.getSlotForDate("2026-05-06")?.garmentIds).toEqual(["g1"]);
    expect(store.getSlotForDate("2026-05-07")?.garmentIds).toEqual(["g2"]);
  });
});
