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
import {
  advanceCarePlanAfterCompletion,
  careTypeToCompletedActivity,
  ensurePendingTask,
} from "@/lib/care-utils";
import { connectToDatabase } from "@/lib/db";
import { objectIdParamSchema } from "@/lib/validators/common";
import { taskNotesBodySchema } from "@/lib/validators/tasks";
import ActivityLog from "@/models/ActivityLog";
import CarePlan from "@/models/CarePlan";
import Task from "@/models/Task";
import { serializeTask } from "@/lib/serializers";
import type { CarePlanType } from "@/types/plant";

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
        return errorResponse("Not found", "Task not found", 404);
      }
      if (task.status !== "pending" && task.status !== "snoozed") {
        await session.abortTransaction();
        return errorResponse(
          "Bad request",
          "Only pending or snoozed tasks can be completed",
          400
        );
      }

      const now = new Date();
      task.status = "completed";
      task.completedAt = now;
      task.snoozedUntil = null;
      if (notes !== undefined) task.notes = notes;
      await task.save({ session });

      const isCustom = task.type === "custom";
      await ActivityLog.create(
        [
          {
            userId,
            plantId: task.plantId,
            taskId: task._id,
            action: isCustom
              ? "custom_task_done"
              : careTypeToCompletedActivity(task.type as CarePlanType),
            date: now,
            notes: notes ?? task.notes,
          },
        ],
        { session }
      );

      if (!isCustom) {
        const carePlan = await CarePlan.findOne({
          _id: task.carePlanId,
          userId,
        }).session(session);
        if (carePlan?.isActive) {
          const nextDue = await advanceCarePlanAfterCompletion({
            carePlan,
            completedAt: now,
            session,
          });
          await ensurePendingTask({
            userId,
            plantId: task.plantId,
            carePlanId: carePlan._id,
            type: carePlan.type,
            dueAt: nextDue,
            session,
          });
        }
      }

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

    let nextScheduledDueAt: string | null = null;
    const u = updated as {
      type?: string;
      carePlanId?: Types.ObjectId;
    };
    const ut = String(u.type ?? "");
    if (ut !== "custom" && u.carePlanId) {
      const cp = await CarePlan.findOne({
        _id: u.carePlanId,
        userId,
      }).lean();
      const next = cp && "nextDueAt" in cp ? cp.nextDueAt : null;
      if (next) {
        nextScheduledDueAt = new Date(next as Date).toISOString();
      }
    }

    return successResponse("Task completed", {
      ...serializeTask(updated),
      nextScheduledDueAt,
    });
  } catch (err) {
    return handleServerError(err);
  }
}
