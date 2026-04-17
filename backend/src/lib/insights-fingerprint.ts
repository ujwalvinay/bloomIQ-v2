import { createHash } from "crypto";

export type InsightsStatsFingerprintInput = {
  totalPlants: number;
  healthyPlants: number;
  needsAttentionPlants: number;
  livingZones: number;
  tasksDueToday: number;
  overdueTasks: number;
  completedThisWeek: number;
};

export function buildInsightsStatsFingerprint(
  input: InsightsStatsFingerprintInput
): string {
  const payload = JSON.stringify({
    totalPlants: input.totalPlants,
    healthyPlants: input.healthyPlants,
    needsAttentionPlants: input.needsAttentionPlants,
    livingZones: input.livingZones,
    tasksDueToday: input.tasksDueToday,
    overdueTasks: input.overdueTasks,
    completedThisWeek: input.completedThisWeek,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}
