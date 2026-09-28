export const PLANS = {
  free: { priceUsd: 0, connections: 1, inboxes: 2, eventsPerMonth: 500, fileBytes: 100 * 1024 ** 2, stateBytes: 1 * 1024 ** 2, eventDays: 7, fileDays: 1, maxFileBytes: 100 * 1024 ** 2 },
  plus: { priceUsd: 19, connections: 3, inboxes: 10, eventsPerMonth: 10_000, fileBytes: 5 * 1024 ** 3, stateBytes: 25 * 1024 ** 2, eventDays: 30, fileDays: 7, maxFileBytes: 1 * 1024 ** 3 },
  pro: { priceUsd: 49, connections: 10, inboxes: 50, eventsPerMonth: 100_000, fileBytes: 25 * 1024 ** 3, stateBytes: 100 * 1024 ** 2, eventDays: 90, fileDays: 30, maxFileBytes: 1 * 1024 ** 3 },
} as const;

export type PlanName = keyof typeof PLANS;
export type PlanDefinition = (typeof PLANS)[PlanName];

export function planFor(name: PlanName): PlanDefinition {
  return PLANS[name];
}
