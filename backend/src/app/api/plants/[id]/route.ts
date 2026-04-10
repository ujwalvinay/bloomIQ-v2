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
import { objectIdParamSchema } from "@/lib/validators/common";
import { updatePlantBodySchema } from "@/lib/validators/plants";
import Plant from "@/models/Plant";
import CarePlan from "@/models/CarePlan";
import Task from "@/models/Task";
import ActivityLog from "@/models/ActivityLog";
import { serializePlant } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const { id } = await context.params;
    const idParsed = objectIdParamSchema.safeParse(id);
    if (!idParsed.success) {
      return errorResponse("Bad request", "Invalid plant id", 400);
    }
    const plant = await Plant.findOne({
      _id: idParsed.data,
      userId: new Types.ObjectId(auth.user._id),
    }).lean();
    if (!plant) {
      return errorResponse("Not found", "Plant not found", 404);
    }
    return successResponse("Plant fetched", serializePlant(plant));
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const { id } = await context.params;
    const idParsed = objectIdParamSchema.safeParse(id);
    if (!idParsed.success) {
      return errorResponse("Bad request", "Invalid plant id", 400);
    }
    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const parsed = updatePlantBodySchema.safeParse(raw.data);
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
    const plant = await Plant.findOneAndUpdate(
      {
        _id: idParsed.data,
        userId: new Types.ObjectId(auth.user._id),
      },
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).lean();
    if (!plant) {
      return errorResponse("Not found", "Plant not found", 404);
    }
    return successResponse("Plant updated", serializePlant(plant));
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
      return errorResponse("Bad request", "Invalid plant id", 400);
    }
    const userId = new Types.ObjectId(auth.user._id);
    const plantObjectId = new Types.ObjectId(idParsed.data);
    const exists = await Plant.exists({ _id: plantObjectId, userId });
    if (!exists) {
      return errorResponse("Not found", "Plant not found", 404);
    }
    const carePlanIds = await CarePlan.find({ plantId: plantObjectId }).distinct(
      "_id"
    );
    await Promise.all([
      Task.deleteMany({
        userId,
        $or: [{ plantId: plantObjectId }, { carePlanId: { $in: carePlanIds } }],
      }),
      CarePlan.deleteMany({ plantId: plantObjectId, userId }),
      ActivityLog.deleteMany({ plantId: plantObjectId, userId }),
      Plant.deleteOne({ _id: plantObjectId, userId }),
    ]);
    return successResponse("Plant deleted", { deleted: true as const });
  } catch (err) {
    return handleServerError(err);
  }
}
