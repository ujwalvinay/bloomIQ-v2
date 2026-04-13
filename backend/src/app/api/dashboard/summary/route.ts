export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { handleServerError, successResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getZonedDayBounds, getZonedWeekBounds } from "@/lib/care-utils";
import { connectToDatabase } from "@/lib/db";
import ActivityLog from "@/models/ActivityLog";
import Plant from "@/models/Plant";
import Task from "@/models/Task";
import { serializeActivity } from "@/lib/serializers";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const timezone = auth.user.timezone;
    const { startUtc: dayStart, endUtc: dayEnd } = getZonedDayBounds(timezone);
    const { weekStartUtc, weekEndUtc } = getZonedWeekBounds(timezone);
    const userId = new Types.ObjectId(auth.user._id);

    const [
      totalPlants,
      healthyPlants,
      needsAttentionPlants,
      tasksDueToday,
      overdueTasks,
      completedThisWeek,
      recentActivityDocs,
      distinctLocations,
    ] = await Promise.all([
      Plant.countDocuments({ userId }),
      Plant.countDocuments({ userId, status: "healthy" }),
      Plant.countDocuments({ userId, status: "needs_attention" }),
      Task.countDocuments({
        userId,
        status: "pending",
        dueAt: { $gte: dayStart, $lte: dayEnd },
      }),
      Task.countDocuments({
        userId,
        status: "pending",
        dueAt: { $lt: dayStart },
      }),
      Task.countDocuments({
        userId,
        status: { $in: ["completed", "done"] },
        completedAt: {
          $gte: weekStartUtc,
          $lte: weekEndUtc,
        },
      }),
      ActivityLog.find({ userId })
        .sort({ date: -1 })
        .limit(10)
        .lean(),
      Plant.distinct("location", {
        userId,
        location: { $nin: [null, ""] },
      }),
    ]);

    return successResponse("Dashboard summary", {
      timezone,
      totalPlants,
      healthyPlants,
      needsAttentionPlants,
      livingZones: distinctLocations.length,
      tasksDueToday,
      overdueTasks,
      completedThisWeek,
      recentActivities: recentActivityDocs.map(serializeActivity),
    });
  } catch (err) {
    return handleServerError(err);
  }
}
