import {
  computeNextSundayAt7pm,
  createInMemorySchedulerAdapter,
  setScheduler,
  schedule,
  cancel,
  list,
  cancelAll
} from "../lib/scheduler";

describe("Scheduler Boundary", () => {
  beforeEach(() => {
    setScheduler(createInMemorySchedulerAdapter());
  });

  describe("Time Helpers", () => {
    it("computeNextSundayAt7pm returns next Sunday when today is Monday", () => {
      // 2026-05-04 is a Monday
      const monday = new Date("2026-05-04T12:00:00Z");
      const nextSunday = computeNextSundayAt7pm(monday);
      
      expect(nextSunday.getDay()).toBe(0);
      expect(nextSunday.getHours()).toBe(19);
      expect(nextSunday.getDate()).toBe(10); // 2026-05-10
    });

    it("computeNextSundayAt7pm returns following Sunday when today is Sunday", () => {
      // 2026-05-10 is a Sunday
      const sunday = new Date("2026-05-10T12:00:00Z");
      const nextSunday = computeNextSundayAt7pm(sunday);
      
      expect(nextSunday.getDay()).toBe(0);
      expect(nextSunday.getHours()).toBe(19);
      expect(nextSunday.getDate()).toBe(17); // 2026-05-17
    });
  });

  describe("In-Memory Fake Adapter", () => {
    it("schedules notifications idenpotently", async () => {
      const spec = {
        id: "test-notif",
        namespace: "planner",
        title: "Test",
        body: "Test body",
        triggerDate: new Date("2026-05-10T19:00:00Z")
      };

      await schedule(spec);
      const items1 = await list("planner");
      expect(items1).toHaveLength(1);

      // Scheduling again with the same ID overrides, doesn't duplicate
      await schedule({ ...spec, title: "Test 2" });
      const items2 = await list("planner");
      expect(items2).toHaveLength(1);
      expect(items2[0]?.title).toBe("Test 2");
    });

    it("cancels specific notifications by ID", async () => {
      await schedule({
        id: "1",
        namespace: "planner",
        title: "Test 1",
        body: "B",
        triggerDate: new Date()
      });
      await schedule({
        id: "2",
        namespace: "planner",
        title: "Test 2",
        body: "B",
        triggerDate: new Date()
      });

      await cancel("1");
      const items = await list("planner");
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe("2");
    });

    it("cancels all notifications by namespace", async () => {
      await schedule({
        id: "1",
        namespace: "planner",
        title: "Test 1",
        body: "B",
        triggerDate: new Date()
      });
      await schedule({
        id: "2",
        namespace: "other",
        title: "Test 2",
        body: "B",
        triggerDate: new Date()
      });

      await cancelAll("planner");
      expect(await list("planner")).toHaveLength(0);
      expect(await list("other")).toHaveLength(1);
    });
  });
});
