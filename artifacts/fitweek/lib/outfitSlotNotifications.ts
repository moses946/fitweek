import { schedule, computeNextSundayAt7pm } from "./scheduler";

/**
 * Schedules (or reschedules) the weekly Sunday 7pm planner notification.
 * Uses the Scheduler boundary to remain testable.
 */
export async function scheduleSundayPlannerNotification(): Promise<void> {
  const nextSunday = computeNextSundayAt7pm(new Date());

  await schedule({
    id: "sunday-planner-reminder",
    namespace: "planner",
    title: "Plan your week",
    body: "Sunday evening — a great time to plan next week's outfits!",
    triggerDate: nextSunday,
  });
}
