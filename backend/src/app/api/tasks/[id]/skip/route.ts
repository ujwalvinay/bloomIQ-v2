import type { NextRequest } from "next/server";
import mongoose, { Types } from "mongoose";
import {
  errorResponse,
  formatZodError,
  handleServerError,
  parseJsonBody,
  successResponse,
} from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { objectIdParamSchema } from "@/lib/validators/common";
import { taskNotesBodySchema } from "@/lib/validators/tasks";
import ActivityLog from "@/models/ActivityLog";
import Task from "@/models/Task";
import { serializeTask } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const { id } = await context.params;
    const idParsed = objectIdParamSchema.safeParse(id);
    if (!idParsed.success) {
      return errorResponse("Bad request", "Invalid task id", 400);
    }

    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const bodyParsed = taskNotesBodySchema.safeParse(raw.data);
    if (!bodyParsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(bodyParsed.error),
        422
      );
    }
    const notes = bodyParsed.data.notes;

    const userId = new Types.ObjectId(auth.user._id);
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const task = await Task.findOne({
        _id: idParsed.data,
        userId,
      }).session(session);
      if (!task) {
        await session.abortTransaction();
        await session.endSession();
        return errorResponse("Not found", "Task not found", 404);
      }
      if (task.status !== "pending" && task.status !== "snoozed") {
        await session.abortTransaction();
        await session.endSession();
        return errorResponse(
          "Bad request",
          "Only pending or snoozed tasks can be skipped",
          400
        );
      }

      task.status = "skipped";
      task.snoozedUntil = null;
      if (notes !== undefined) task.notes = notes;
      await task.save({ session });

      await ActivityLog.create(
        [
          {
            userId,
            plantId: task.plantId,
            taskId: task._id,
            action: "task_skipped",
            date: new Date(),
            notes: notes ?? task.notes,
          },
        ],
        { session }
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    const updated = await Task.findOne({
      _id: idParsed.data,
      userId,
    }).lean();
    if (!updated) {
      return errorResponse("Not found", "Task not found", 404);
    }
    return successResponse("Task skipped", serializeTask(updated));
  } catch (err) {
    return handleServerError(err);
  }
}
