import { createHash } from "crypto";
import { Types } from "mongoose";
import { getZonedDayBounds, getZonedWeekBounds } from "@/lib/care-utils";
import Plant from "@/models/Plant";
import Task from "@/models/Task";

export type InsightsStatsPayload = {
  timezone: string;
  totalPlants: number;
  healthyPlants: number;
  needsAttentionPlants: number;
  livingZones: number;
  tasksDueToday: number;
  overdueTasks: number;
  completedThisWeek: number;
  attentionSamples: Array<{
    name: string;
    species?: string;
    location?: string;
  }>;
};

export function fingerprintForInsights(stats: InsightsStatsPayload): string {
  const compact = {
    totalPlants: stats.totalPlants,
    healthyPlants: stats.healthyPlants,
    needsAttentionPlants: stats.needsAttentionPlants,
    livingZones: stats.livingZones,
    tasksDueToday: stats.tasksDueToday,
    overdueTasks: stats.overdueTasks,
    completedThisWeek: stats.completedThisWeek,
    attentionNames: stats.attentionSamples.map((p) => p.name).sort(),
  };
  return createHash("sha256")
    .update(JSON.stringify(compact))
    .digest("hex")
    .slice(0, 32);
}

export async function loadInsightsStatsForUser(input: {
  userId: Types.ObjectId;
  timezone: string;
}): Promise<InsightsStatsPayload> {
  const { startUtc: dayStart, endUtc: dayEnd } = getZonedDayBounds(
    input.timezone
  );
  const { weekStartUtc, weekEndUtc } = getZonedWeekBounds(input.timezone);

  const [
    totalPlants,
    healthyPlants,
    needsAttentionPlants,
    tasksDueToday,
    overdueTasks,
    completedThisWeek,
    distinctLocations,
    attentionDocs,
  ] = await Promise.all([
    Plant.countDocuments({ userId: input.userId }),
    Plant.countDocuments({ userId: input.userId, status: "healthy" }),
    Plant.countDocuments({
      userId: input.userId,
      status: "needs_attention",
    }),
    Task.countDocuments({
      userId: input.userId,
      status: "pending",
      dueAt: { $gte: dayStart, $lte: dayEnd },
    }),
    Task.countDocuments({
      userId: input.userId,
      status: "pending",
      dueAt: { $lt: dayStart },
    }),
    Task.countDocuments({
      userId: input.userId,
      status: { $in: ["completed", "done"] },
      completedAt: {
        $gte: weekStartUtc,
        $lte: weekEndUtc,
      },
    }),
    Plant.distinct("location", {
      userId: input.userId,
      location: { $nin: [null, ""] },
    }),
    Plant.find({
      userId: input.userId,
      status: "needs_attention",
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select("name species location")
      .lean(),
  ]);

  const attentionSamples = attentionDocs.map((d) => ({
    name: String((d as { name?: string }).name ?? "Plant"),
    species: (d as { species?: string }).species,
    location: (d as { location?: string }).location,
  }));

  return {
    timezone: input.timezone,
    totalPlants,
    healthyPlants,
    needsAttentionPlants,
    livingZones: distinctLocations.length,
    tasksDueToday,
    overdueTasks,
    completedThisWeek,
    attentionSamples,
  };
}
