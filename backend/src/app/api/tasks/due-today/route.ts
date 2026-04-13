export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { handleServerError, successResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getZonedDayBounds } from "@/lib/care-utils";
import { connectToDatabase } from "@/lib/db";
import Task from "@/models/Task";
import { serializeTask } from "@/lib/serializers";

/**
 * Pending tasks that are actionable now: due on the user's local calendar day
 * (today) or earlier (overdue). Future-dated tasks are omitted so completed
 * care can roll to the next due date without reappearing until that day.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const timezone = auth.user.timezone;
    const now = new Date();
    const { startUtc, endUtc } = getZonedDayBounds(timezone, now);
    const userId = new Types.ObjectId(auth.user._id);

    const [dueToday, overdue] = await Promise.all([
      Task.find({
        userId,
        status: "pending",
        dueAt: { $gte: startUtc, $lte: endUtc },
      })
        .sort({ dueAt: 1 })
        .lean(),
      Task.find({
        userId,
        status: "pending",
        dueAt: { $lt: startUtc },
      })
        .sort({ dueAt: 1 })
        .limit(100)
        .lean(),
    ]);

    return successResponse("Tasks due today", {
      timezone,
      window: { start: startUtc.toISOString(), end: endUtc.toISOString() },
      dueToday: dueToday.map(serializeTask),
      overdue: overdue.map(serializeTask),
    });
  } catch (err) {
    return handleServerError(err);
  }
}
