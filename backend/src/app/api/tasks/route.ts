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
import { userDueDateToStartUtc } from "@/lib/care-utils";
import { connectToDatabase } from "@/lib/db";
import {
  createCustomTaskBodySchema,
  tasksListQuerySchema,
} from "@/lib/validators/tasks";
import Plant from "@/models/Plant";
import Task from "@/models/Task";
import { serializeTask } from "@/lib/serializers";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const qs = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = tasksListQuerySchema.safeParse(qs);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    const { page, limit, status, type, plantId, from, to } = parsed.data;
    if (from && to && from > to) {
      return errorResponse(
        "Bad request",
        "`from` must be before or equal to `to`",
        400
      );
    }
    const userId = new Types.ObjectId(auth.user._id);
    const filter: Record<string, unknown> = { userId };
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (plantId) filter.plantId = new Types.ObjectId(plantId);
    if (from || to) {
      filter.dueAt = {};
      if (from) (filter.dueAt as Record<string, Date>).$gte = from;
      if (to) (filter.dueAt as Record<string, Date>).$lte = to;
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Task.find(filter)
        .sort({ dueAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Task.countDocuments(filter),
    ]);
    return successResponse("Tasks fetched", {
      items: items.map(serializeTask),
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
    const parsed = createCustomTaskBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }

    const { plantId, title, dueDate, notes } = parsed.data;
    const userId = new Types.ObjectId(auth.user._id);
    const plant = await Plant.findOne({
      _id: new Types.ObjectId(plantId),
      userId,
    }).lean();
    if (!plant) {
      return errorResponse("Not found", "Plant not found", 404);
    }

    let dueAt: Date;
    try {
      dueAt = userDueDateToStartUtc(dueDate, auth.user.timezone);
    } catch {
      return errorResponse("Bad request", "Invalid due date", 400);
    }

    const task = await Task.create({
      userId,
      plantId: new Types.ObjectId(plantId),
      type: "custom",
      title,
      dueAt,
      status: "pending",
      notes: notes?.trim() ? notes.trim() : undefined,
    });

    return successResponse("Task created", serializeTask(task.toObject()));
  } catch (err) {
    return handleServerError(err);
  }
}
