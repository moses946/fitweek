/**
 * Outfit slot notifications — Sunday 7pm planner reminder.
 *
 * Issue 5 TDD — Test 10:
 *   computeNextSundayAt7pm(now) returns the next Sunday at 19:00:00 local time.
 *   The scheduling function is covered by integration testing only.
 */

// ── Pure helper (unit-testable) ───────────────────────────────────────────────

/**
 * Returns the next Sunday at 19:00:00 local time relative to `now`.
 * If `now` is itself a Sunday, returns the following Sunday.
 */
export function computeNextSundayAt7pm(now: Date): Date {
  const result = new Date(now);
  const dayOfWeek = result.getDay(); // 0 = Sunday
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  result.setDate(result.getDate() + daysUntilSunday);
  result.setHours(19, 0, 0, 0);
  return result;
}

// ── Notification scheduling (requires expo-notifications) ────────────────────

/**
 * Schedules (or reschedules) the weekly Sunday 7pm planner notification.
 * Silently no-ops if permission is not granted or expo-notifications fails.
 */
export async function scheduleSundayPlannerNotification(): Promise<void> {
  try {
    // Dynamic import so the module doesn't crash in test environments
    const Notifications = await import("expo-notifications");

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const nextSunday = computeNextSundayAt7pm(new Date());
    const secondsUntil = Math.max(
      1,
      Math.floor((nextSunday.getTime() - Date.now()) / 1000),
    );

    // Cancel any existing planner notification before rescheduling
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.title === "Plan your week") {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Plan your week",
        body: "Sunday evening — a great time to plan next week's outfits!",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
        repeats: false,
      },
    });
  } catch {
    // Non-fatal
  }
}
