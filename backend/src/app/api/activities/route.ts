export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import {
  errorResponse,
  formatZodError,
  handleServerError,
  parseJsonBody,
  successResponse,
} from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  activitiesListQuerySchema,
  createActivityBodySchema,
} from "@/lib/validators/tasks";
import ActivityLog from "@/models/ActivityLog";
import Plant from "@/models/Plant";
import Task from "@/models/Task";
import { serializeActivitiesWithResolvedTaskTitles } from "@/lib/activity-response";
import { serializeActivity } from "@/lib/serializers";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const qs = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = activitiesListQuerySchema.safeParse(qs);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    const { page, limit, plantId, action } = parsed.data;
    const userId = new Types.ObjectId(auth.user._id);
    const filter: Record<string, unknown> = { userId };
    if (plantId) filter.plantId = new Types.ObjectId(plantId);
    if (action) filter.action = action;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);
    const serializedItems = await serializeActivitiesWithResolvedTaskTitles(
      items,
      userId
    );
    return successResponse("Activities fetched", {
      items: serializedItems,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const parsed = createActivityBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    const body = parsed.data;
    const userId = new Types.ObjectId(auth.user._id);
    const plant = await Plant.findOne({
      _id: new Types.ObjectId(body.plantId),
      userId,
    });
    if (!plant) {
      return errorResponse("Not found", "Plant not found", 404);
    }
    if (body.taskId) {
      const task = await Task.findOne({
        _id: new Types.ObjectId(body.taskId),
        userId,
      });
      if (!task) {
        return errorResponse("Not found", "Task not found", 404);
      }
    }

    const doc = await ActivityLog.create({
      userId,
      plantId: plant._id,
      taskId: body.taskId ? new Types.ObjectId(body.taskId) : undefined,
      action: body.action,
      date: body.date ?? new Date(),
      notes: body.notes,
    });
    return successResponse(
      "Activity logged",
      serializeActivity(doc.toObject()),
      201
    );
  } catch (err) {
    return handleServerError(err);
  }
}
