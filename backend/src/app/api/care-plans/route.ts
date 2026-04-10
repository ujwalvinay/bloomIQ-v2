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
import {
  computeInitialNextDueAt,
  ensurePendingTask,
  isDueOnOrBeforeEndOfUserDay,
} from "@/lib/care-utils";
import { connectToDatabase } from "@/lib/db";
import {
  carePlansListQuerySchema,
  createCarePlanBodySchema,
} from "@/lib/validators/carePlans";
import Plant from "@/models/Plant";
import CarePlan from "@/models/CarePlan";
import { serializeCarePlan } from "@/lib/serializers";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const qs = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = carePlansListQuerySchema.safeParse(qs);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    const { plantId, type, isActive } = parsed.data;
    const userId = new Types.ObjectId(auth.user._id);
    const filter: Record<string, unknown> = { userId };
    if (plantId) filter.plantId = new Types.ObjectId(plantId);
    if (type) filter.type = type;
    if (typeof isActive === "boolean") filter.isActive = isActive;

    const items = await CarePlan.find(filter)
      .sort({ nextDueAt: 1 })
      .lean();
    return successResponse(
      "Care plans fetched",
      items.map(serializeCarePlan)
    );
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
    const parsed = createCarePlanBodySchema.safeParse(raw.data);
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

    const timezone = auth.user.timezone;
    const nextDueAt =
      body.nextDueAt ?? computeInitialNextDueAt(body.startDate, timezone);
    const isActive = body.isActive ?? true;

    try {
      const doc = await CarePlan.create({
        userId,
        plantId: plant._id,
        type: body.type,
        frequencyDays: body.frequencyDays,
        startDate: body.startDate,
        lastCompletedAt: body.lastCompletedAt ?? null,
        nextDueAt,
        isActive,
      });

      if (
        isActive &&
        isDueOnOrBeforeEndOfUserDay(nextDueAt, timezone)
      ) {
        await ensurePendingTask({
          userId,
          plantId: new Types.ObjectId(plant._id),
          carePlanId: doc._id,
          type: body.type,
          dueAt: nextDueAt,
        });
      }

      return successResponse(
        "Care plan created",
        serializeCarePlan(doc.toObject()),
        201
      );
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        return errorResponse(
          "Conflict",
          "An active care plan of this type already exists for this plant",
          409
        );
      }
      throw err;
    }
  } catch (err) {
    return handleServerError(err);
  }
}
