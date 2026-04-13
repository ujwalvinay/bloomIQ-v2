export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import {
  errorResponse,
  formatZodError,
  handleServerError,
  successResponse,
} from "@/lib/api";
import { toCalendarTaskRow } from "@/lib/calendar-tasks";
import { requireAuth } from "@/lib/auth";
import { getUserCalendarDayBoundsUtc } from "@/lib/care-utils";
import { connectToDatabase } from "@/lib/db";
import { calendarDayQuerySchema } from "@/lib/validators/tasks";
import Task from "@/models/Task";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const qs = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = calendarDayQuerySchema.safeParse(qs);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    const { date } = parsed.data;
    const timezone = auth.user.timezone;
    let startUtc: Date;
    let endUtc: Date;
    try {
      ({ startUtc, endUtc } = getUserCalendarDayBoundsUtc(date, timezone));
    } catch {
      return errorResponse("Bad request", "Invalid date", 400);
    }

    const userId = new Types.ObjectId(auth.user._id);

    const [scheduled, completed] = await Promise.all([
      Task.find({
        userId,
        status: { $in: ["pending", "snoozed"] },
        dueAt: { $gte: startUtc, $lte: endUtc },
      })
        .populate("plantId", "name location")
        .sort({ dueAt: 1 })
        .lean(),
      Task.find({
        userId,
        status: { $in: ["completed", "done"] },
        completedAt: {
          $gte: startUtc,
          $lte: endUtc,
          $ne: null,
        },
      })
        .populate("plantId", "name location")
        .sort({ completedAt: -1 })
        .lean(),
    ]);

    return successResponse("Calendar day", {
      date,
      timezone,
      window: { start: startUtc.toISOString(), end: endUtc.toISOString() },
      scheduled: scheduled.map(toCalendarTaskRow),
      completed: completed.map(toCalendarTaskRow),
    });
  } catch (err) {
    return handleServerError(err);
  }
}
