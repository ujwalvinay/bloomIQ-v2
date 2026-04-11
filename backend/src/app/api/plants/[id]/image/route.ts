export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { errorResponse, handleServerError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { PLANT_IMAGE_MIME, normalizePlantImageBuffer } from "@/lib/plant-image";
import { objectIdParamSchema } from "@/lib/validators/common";
import Plant from "@/models/Plant";

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

    const plant = (await Plant.findOne({
      _id: idParsed.data,
      userId: new Types.ObjectId(auth.user._id),
    })
      // imageData / imageMimeType use select:false; must use + to load from MongoDB
      .select("+imageData +imageMimeType")
      .lean()) as {
      imageData?: unknown;
      imageMimeType?: string;
    } | null;

    if (!plant) {
      return errorResponse("Not found", "Plant not found", 404);
    }

    const buf = normalizePlantImageBuffer(plant.imageData);

    if (!buf?.length) {
      return errorResponse("Not found", "Plant image not found", 404);
    }

    const mime =
      typeof plant.imageMimeType === "string" &&
      PLANT_IMAGE_MIME.has(plant.imageMimeType)
        ? plant.imageMimeType
        : "image/jpeg";

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return handleServerError(err);
  }
}
