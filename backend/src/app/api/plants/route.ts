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
  createPlantBodySchema,
  plantsListQuerySchema,
} from "@/lib/validators/plants";
import Plant from "@/models/Plant";
import { serializePlant } from "@/lib/serializers";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const qs = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = plantsListQuerySchema.safeParse(qs);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    const { page, limit, search, status } = parsed.data;
    const userId = new Types.ObjectId(auth.user._id);
    const filter: Record<string, unknown> = { userId };
    if (status) filter.status = status;
    if (search?.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: rx },
        { species: rx },
        { location: rx },
      ];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Plant.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Plant.countDocuments(filter),
    ]);
    return successResponse("Plants fetched", {
      items: items.map(serializePlant),
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
    const parsed = createPlantBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    const body = parsed.data;
    const plant = await Plant.create({
      userId: new Types.ObjectId(auth.user._id),
      name: body.name,
      species: body.species,
      location: body.location,
      imageUrl: body.imageUrl,
      notes: body.notes,
      status: body.status ?? "healthy",
    });
    return successResponse("Plant created", serializePlant(plant.toObject()), 201);
  } catch (err) {
    return handleServerError(err);
  }
}
