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
import {
  fetchGeminiPlantProfile,
  getGeminiApiKey,
} from "@/lib/gemini-plant-profile";
import CarePlan from "@/models/CarePlan";
import Plant from "@/models/Plant";
import { serializePlant } from "@/lib/serializers";

let loggedMissingGeminiKey = false;

type PlantCreateFields = {
  userId: Types.ObjectId;
  name: string;
  species?: string;
  location?: string;
  imageUrl?: string;
  imageData?: Buffer;
  imageMimeType?: string;
  hasEmbeddedImage: boolean;
  notes?: string;
  status: string;
};

async function withGeminiProfile(
  fields: PlantCreateFields
): Promise<
  PlantCreateFields & {
    lightLevel?: string;
    careGuide?: {
      watering: string;
      sunlight: string;
      fertilizer: string;
      temperature: string;
    };
  }
> {
  if (!getGeminiApiKey()) {
    if (process.env.NODE_ENV === "development" && !loggedMissingGeminiKey) {
      loggedMissingGeminiKey = true;
      console.info(
        "[BloomIQ] GEMINI_API_KEY is not set on the backend — plants are saved without AI care guides or light level. Add it to backend/.env and restart the API server."
      );
    }
    return fields;
  }

  const ai = await fetchGeminiPlantProfile({
    name: fields.name,
    species: fields.species,
    location: fields.location,
  });
  if (!ai) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[BloomIQ] Gemini call returned no profile — plant saved without careGuide/lightLevel. See earlier [BloomIQ Gemini] logs."
      );
    }
    return fields;
  }
  return {
    ...fields,
    lightLevel: ai.lightLevel,
    careGuide: ai.careGuide,
  };
}

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
    const {
      page,
      limit,
      search,
      status,
      location,
      sort,
      includeArchived,
    } = parsed.data;
    const userId = new Types.ObjectId(auth.user._id);
    const filter: Record<string, unknown> = { userId };
    if (status) {
      filter.status = status;
    } else if (!includeArchived) {
      filter.status = { $ne: "archived" };
    }
    if (location?.trim()) {
      filter.location = new RegExp(
        `^${location.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      );
    }
    if (search?.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: rx },
        { species: rx },
        { location: rx },
        { notes: rx },
        { careRequirements: rx },
        { "careGuide.watering": rx },
        { "careGuide.sunlight": rx },
        { "careGuide.fertilizer": rx },
        { "careGuide.temperature": rx },
      ];
    }
    const skip = (page - 1) * limit;

    if (sort === "watering") {
      const [all, total] = await Promise.all([
        Plant.find(filter).lean(),
        Plant.countDocuments(filter),
      ]);
      const plans = await CarePlan.find({
        userId,
        type: "watering",
        isActive: true,
      })
        .select("plantId nextDueAt")
        .lean();
      const nextByPlant = new Map<string, number>();
      for (const p of plans) {
        nextByPlant.set(String(p.plantId), new Date(p.nextDueAt).getTime());
      }
      const inf = Number.MAX_SAFE_INTEGER;
      all.sort((a, b) => {
        const ta = nextByPlant.get(String(a._id)) ?? inf;
        const tb = nextByPlant.get(String(b._id)) ?? inf;
        if (ta !== tb) return ta - tb;
        return (
          new Date(b.createdAt as Date).getTime() -
          new Date(a.createdAt as Date).getTime()
        );
      });
      const slice = all.slice(skip, skip + limit);
      return successResponse("Plants fetched", {
        items: slice.map(serializePlant),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      });
    }

    const [items, total] = await Promise.all([
      Plant.find(filter)
        .sort(sort === "name" ? { name: 1 } : { createdAt: -1 })
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

      const plant = await Plant.create(
        await withGeminiProfile({
          userId,
          name,
          species: species || undefined,
          location: location || undefined,
          imageUrl: hasEmbeddedImage ? undefined : imageUrl,
          imageData: hasEmbeddedImage ? imageData : undefined,
          imageMimeType: hasEmbeddedImage ? imageMimeType : undefined,
          hasEmbeddedImage,
          status: "healthy",
        })
      );
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

    const plant = await Plant.create(
      await withGeminiProfile({
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
      })
    );
    return successResponse("Plant created", serializePlant(plant.toObject()), 201);
  } catch (err) {
    return handleServerError(err);
  }
}
