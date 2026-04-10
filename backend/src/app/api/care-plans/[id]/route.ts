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
import {
  ensurePendingTask,
  isDueOnOrBeforeEndOfUserDay,
} from "@/lib/care-utils";
import { connectToDatabase } from "@/lib/db";
import { objectIdParamSchema } from "@/lib/validators/common";
import { updateCarePlanBodySchema } from "@/lib/validators/carePlans";
import CarePlan from "@/models/CarePlan";
import Task from "@/models/Task";
import { serializeCarePlan } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const { id } = await context.params;
    const idParsed = objectIdParamSchema.safeParse(id);
    if (!idParsed.success) {
      return errorResponse("Bad request", "Invalid care plan id", 400);
    }
    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const parsed = updateCarePlanBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    if (Object.keys(parsed.data).length === 0) {
      return errorResponse("Bad request", "No fields to update", 400);
    }

    const userId = new Types.ObjectId(auth.user._id);
    const existing = await CarePlan.findOne({
      _id: idParsed.data,
      userId,
    });
    if (!existing) {
      return errorResponse("Not found", "Care plan not found", 404);
    }

    const nextIsActive =
      parsed.data.isActive !== undefined
        ? parsed.data.isActive
        : existing.isActive;

    if (nextIsActive) {
      const conflict = await CarePlan.findOne({
        _id: { $ne: existing._id },
        plantId: existing.plantId,
        type: existing.type,
        isActive: true,
      }).lean();
      if (conflict) {
        return errorResponse(
          "Conflict",
          "Another active care plan of this type exists for this plant",
          409
        );
      }
    }

    Object.assign(existing, parsed.data);
    try {
      await existing.save();
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        return errorResponse(
          "Conflict",
          "Duplicate active care plan for this plant and type",
          409
        );
      }
      throw err;
    }

    const timezone = auth.user.timezone;
    if (
      existing.isActive &&
      isDueOnOrBeforeEndOfUserDay(existing.nextDueAt, timezone)
    ) {
      await ensurePendingTask({
        userId,
        plantId: existing.plantId,
        carePlanId: existing._id,
        type: existing.type,
        dueAt: existing.nextDueAt,
      });
    }

    return successResponse(
      "Care plan updated",
      serializeCarePlan(existing.toObject())
    );
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const { id } = await context.params;
    const idParsed = objectIdParamSchema.safeParse(id);
    if (!idParsed.success) {
      return errorResponse("Bad request", "Invalid care plan id", 400);
    }
    const userId = new Types.ObjectId(auth.user._id);
    const plan = await CarePlan.findOne({
      _id: idParsed.data,
      userId,
    });
    if (!plan) {
      return errorResponse("Not found", "Care plan not found", 404);
    }
    const planId = plan._id as Types.ObjectId;
    await Promise.all([
      Task.deleteMany({ carePlanId: planId, userId }),
      CarePlan.deleteOne({ _id: planId, userId }),
    ]);
    return successResponse("Care plan deleted", { deleted: true as const });
  } catch (err) {
    return handleServerError(err);
  }
}
