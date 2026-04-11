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
import {
  MAX_PLANT_IMAGE_BYTES,
  PLANT_IMAGE_MIME,
  normalizeImageMimeType,
  sniffImageMime,
} from "@/lib/plant-image";
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

    const userId = new Types.ObjectId(auth.user._id);
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const nameRaw = form.get("name");
      const name =
        typeof nameRaw === "string" ? nameRaw.trim() : "";
      if (!name) {
        return errorResponse("Validation failed", "name is required", 422);
      }
      if (name.length > 200) {
        return errorResponse("Validation failed", "name is too long", 422);
      }

      const speciesRaw = form.get("species");
      const species =
        typeof speciesRaw === "string" ? speciesRaw.trim() : "";
      if (species.length > 200) {
        return errorResponse("Validation failed", "species is too long", 422);
      }

      const locationRaw = form.get("location");
      const location =
        typeof locationRaw === "string" ? locationRaw.trim() : "";
      if (location.length > 200) {
        return errorResponse("Validation failed", "location is too long", 422);
      }

      const imageUrlRaw = form.get("imageUrl");
      let imageUrl: string | undefined;
      if (typeof imageUrlRaw === "string") {
        const u = imageUrlRaw.trim();
        if (u.length > 2000) {
          return errorResponse("Validation failed", "imageUrl is too long", 422);
        }
        if (u) imageUrl = u;
      }

      const file = form.get("image");
      let imageData: Buffer | undefined;
      let imageMimeType: string | undefined;
      let hasEmbeddedImage = false;

      if (file instanceof Blob && file.size > 0) {
        if (file.size > MAX_PLANT_IMAGE_BYTES) {
          return errorResponse(
            "Payload too large",
            "Image must be 3MB or smaller",
            413
          );
        }
        const bytes = await file.arrayBuffer();
        const buf = Buffer.from(bytes);
        const sniffed = sniffImageMime(buf);
        const declared =
          file.type && PLANT_IMAGE_MIME.has(normalizeImageMimeType(file.type))
            ? normalizeImageMimeType(file.type)
            : null;
        const mime = sniffed ?? declared;
        if (!mime) {
          return errorResponse(
            "Bad request",
            "Image must be JPEG, PNG, WebP, or GIF",
            400
          );
        }
        imageData = buf;
        imageMimeType = mime;
        hasEmbeddedImage = true;
        imageUrl = undefined;
      }

      const plant = await Plant.create({
        userId,
        name,
        species: species || undefined,
        location: location || undefined,
        imageUrl: hasEmbeddedImage ? undefined : imageUrl,
        imageData: hasEmbeddedImage ? imageData : undefined,
        imageMimeType: hasEmbeddedImage ? imageMimeType : undefined,
        hasEmbeddedImage,
        status: "healthy",
      });
      return successResponse(
        "Plant created",
        serializePlant(plant.toObject()),
        201
      );
    }

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

    let imageData: Buffer | undefined;
    let imageMimeType: string | undefined;
    let hasEmbeddedImage = false;
    let imageUrl = body.imageUrl;

    if (body.imageBase64 && body.imageBase64.length > 0) {
      let buf: Buffer;
      try {
        buf = Buffer.from(body.imageBase64, "base64");
      } catch {
        return errorResponse("Bad request", "Invalid base64 image data", 400);
      }
      if (buf.length > MAX_PLANT_IMAGE_BYTES) {
        return errorResponse(
          "Payload too large",
          "Image must be 3MB or smaller after decoding",
          413
        );
      }
      if (buf.length === 0) {
        return errorResponse("Bad request", "Empty image data", 400);
      }
      const sniffed = sniffImageMime(buf);
      const declared =
        body.imageMimeType &&
        PLANT_IMAGE_MIME.has(normalizeImageMimeType(body.imageMimeType))
          ? normalizeImageMimeType(body.imageMimeType)
          : null;
      const mime = sniffed ?? declared;
      if (!mime) {
        return errorResponse(
          "Bad request",
          "Image must be JPEG, PNG, WebP, or GIF",
          400
        );
      }
      imageData = buf;
      imageMimeType = mime;
      hasEmbeddedImage = true;
      imageUrl = undefined;
    }

    const plant = await Plant.create({
      userId,
      name: body.name,
      species: body.species,
      location: body.location,
      imageUrl: hasEmbeddedImage ? undefined : imageUrl,
      imageData: hasEmbeddedImage ? imageData : undefined,
      imageMimeType: hasEmbeddedImage ? imageMimeType : undefined,
      hasEmbeddedImage,
      notes: body.notes,
      status: body.status ?? "healthy",
    });
    return successResponse("Plant created", serializePlant(plant.toObject()), 201);
  } catch (err) {
    return handleServerError(err);
  }
}
