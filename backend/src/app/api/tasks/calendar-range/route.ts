export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { formatInTimeZone } from "date-fns-tz";
import {
  errorResponse,
  formatZodError,
  handleServerError,
  successResponse,
} from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import {
  getUserCalendarDayBoundsUtc,
  userDueDateToStartUtc,
} from "@/lib/care-utils";
import { connectToDatabase } from "@/lib/db";
import { calendarRangeQuerySchema } from "@/lib/validators/tasks";
import Task from "@/models/Task";

type DayMarks = { scheduledTypes: string[]; completedTypes: string[] };

function addUnique(arr: string[], v: string) {
  if (!arr.includes(v)) arr.push(v);
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const qs = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = calendarRangeQuerySchema.safeParse(qs);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    const { from, to } = parsed.data;
    const timezone = auth.user.timezone;
    let startUtc: Date;
    let endUtc: Date;
    try {
      startUtc = userDueDateToStartUtc(from, timezone);
      endUtc = getUserCalendarDayBoundsUtc(to, timezone).endUtc;
    } catch {
      return errorResponse("Bad request", "Invalid date range", 400);
    }

    const userId = new Types.ObjectId(auth.user._id);

    const [scheduledTasks, completedTasks] = await Promise.all([
      Task.find({
        userId,
        status: { $in: ["pending", "snoozed"] },
        dueAt: { $gte: startUtc, $lte: endUtc },
      })
        .select("dueAt type")
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
        .select("completedAt type")
        .lean(),
    ]);

    const days: Record<string, DayMarks> = {};
    const ensure = (key: string): DayMarks => {
      if (!days[key]) {
        days[key] = { scheduledTypes: [], completedTypes: [] };
      }
      return days[key];
    };

    for (const t of scheduledTasks) {
      const due = t.dueAt;
      if (!due) continue;
      const key = formatInTimeZone(new Date(due), timezone, "yyyy-MM-dd");
      addUnique(ensure(key).scheduledTypes, String(t.type));
    }

    for (const t of completedTasks) {
      const done = t.completedAt;
      if (!done) continue;
      const key = formatInTimeZone(new Date(done), timezone, "yyyy-MM-dd");
      addUnique(ensure(key).completedTypes, String(t.type));
    }

    return successResponse("Calendar range", {
      from,
      to,
      timezone,
      days,
    });
  } catch (err) {
    return handleServerError(err);
  }
}
