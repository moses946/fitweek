/**
 * Notification Scheduler Adapter
 *
 * Purpose:
 * - Centralise pure time helpers (computeNextSundayAt7pm).
 * - Provide a test-friendly interface for scheduling notifications.
 * - Hide `expo-notifications` behind an adapter to prevent testing crashes.
 * - Allow tests to use an in-memory adapter that records scheduling events.
 */

// ── Pure helpers ──────────────────────────────────────────────────────────────

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

// ── Scheduler Adapter Interface ──────────────────────────────────────────────

export type NotificationSpec = {
  id: string; // User-provided ID to allow idempotent scheduling
  namespace: string; // Grouping category (e.g. "planner")
  title: string;
  body: string;
  triggerDate: Date; // Exact date to fire
};

export type ScheduledNotification = NotificationSpec & { scheduledAt: string };

export type SchedulerAdapter = {
  /** Schedules a notification. If the ID is already scheduled, it is replaced (idempotent). */
  schedule: (spec: NotificationSpec) => Promise<void>;
  /** Cancels a specific notification by ID. */
  cancel: (id: string) => Promise<void>;
  /** Cancels all notifications matching the given namespace. */
  cancelAll: (namespace: string) => Promise<void>;
  /** Lists all pending scheduled notifications for a given namespace. */
  list: (namespace: string) => Promise<ScheduledNotification[]>;
};

// ── Default Expo Notifications Adapter ────────────────────────────────────────

const expoSchedulerAdapter: SchedulerAdapter = {
  async schedule(spec: NotificationSpec) {
    try {
      const Notifications = await import("expo-notifications");
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") return;

      // Cancel existing if replacing (idempotent)
      await Notifications.cancelScheduledNotificationAsync(spec.id);

      const secondsUntil = Math.max(
        1,
        Math.floor((spec.triggerDate.getTime() - Date.now()) / 1000)
      );

      await Notifications.scheduleNotificationAsync({
        identifier: spec.id,
        content: {
          title: spec.title,
          body: spec.body,
          sound: true,
          data: { namespace: spec.namespace, id: spec.id }
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
  },

  async cancel(id: string) {
    try {
      const Notifications = await import("expo-notifications");
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  },

  async cancelAll(namespace: string) {
    try {
      const Notifications = await import("expo-notifications");
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of scheduled) {
        if (n.content.data?.namespace === namespace) {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
      }
    } catch {}
  },

  async list(namespace: string) {
    try {
      const Notifications = await import("expo-notifications");
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const results: ScheduledNotification[] = [];
      for (const n of scheduled) {
        if (n.content.data?.namespace === namespace) {
          results.push({
            id: n.identifier,
            namespace,
            title: n.content.title || "",
            body: n.content.body || "",
            triggerDate: new Date(), // Impossible to get back exactly from Expo API on all platforms, placeholder
            scheduledAt: new Date().toISOString(),
          });
        }
      }
      return results;
    } catch {
      return [];
    }
  }
};

// ── In-Memory Fake Adapter ───────────────────────────────────────────────────

export interface InMemorySchedulerAdapter extends SchedulerAdapter {
  clear(): void;
}

export function createInMemorySchedulerAdapter(): InMemorySchedulerAdapter {
  const store = new Map<string, ScheduledNotification>();

  return {
    clear() {
      store.clear();
    },
    async schedule(spec: NotificationSpec) {
      store.set(spec.id, { ...spec, scheduledAt: new Date().toISOString() });
    },
    async cancel(id: string) {
      store.delete(id);
    },
    async cancelAll(namespace: string) {
      for (const [id, notif] of store.entries()) {
        if (notif.namespace === namespace) {
          store.delete(id);
        }
      }
    },
    async list(namespace: string) {
      const results: ScheduledNotification[] = [];
      for (const notif of store.values()) {
        if (notif.namespace === namespace) {
          results.push({ ...notif });
        }
      }
      return results;
    },
  };
}

// ── Module-level Singleton ───────────────────────────────────────────────────

let currentAdapter: SchedulerAdapter = expoSchedulerAdapter;

export function setScheduler(adapter: SchedulerAdapter) {
  currentAdapter = adapter;
}

export function getScheduler(): SchedulerAdapter {
  return currentAdapter;
}

// Convenience delegates
export const schedule = (spec: NotificationSpec) => currentAdapter.schedule(spec);
export const cancel = (id: string) => currentAdapter.cancel(id);
export const cancelAll = (namespace: string) => currentAdapter.cancelAll(namespace);
export const list = (namespace: string) => currentAdapter.list(namespace);

export default {
  setScheduler,
  getScheduler,
  schedule,
  cancel,
  cancelAll,
  list,
  createInMemorySchedulerAdapter,
  computeNextSundayAt7pm,
};
