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
  buildPlantCareChatSystemText,
  fetchGeminiPlantCareChatReply,
} from "@/lib/gemini-care-chat";
import {
  MAX_PLANT_IMAGE_BYTES,
  PLANT_IMAGE_MIME,
  normalizeImageMimeType,
  sniffImageMime,
} from "@/lib/plant-image";
import {
  careChatBodySchema,
  validateCareChatHistory,
} from "@/lib/validators/care-chat";
import { objectIdParamSchema } from "@/lib/validators/common";
import Plant from "@/models/Plant";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
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
    const parsed = careChatBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }

    const history = parsed.data.history.map((h) => ({
      role: h.role,
      content: h.content.trim(),
    }));
    for (const h of history) {
      if (!h.content) {
        return errorResponse(
          "Validation failed",
          "Each history message must contain text after trimming.",
          422
        );
      }
    }

    const histErr = validateCareChatHistory(history);
    if (histErr) {
      return errorResponse("Validation failed", histErr, 422);
    }

    const plantRaw = await Plant.findOne({
      _id: idParsed.data,
      userId: new Types.ObjectId(auth.user._id),
    }).lean();
    if (!plantRaw) {
      return errorResponse("Not found", "Plant not found", 404);
    }
    const plant = plantRaw as unknown as {
      name: string;
      species?: string;
      location?: string;
      lightLevel?: string;
      notes?: string;
      careRequirements?: string;
      careGuide?: {
        watering?: string;
        sunlight?: string;
        fertilizer?: string;
        temperature?: string;
      };
    };

    const message = parsed.data.message.trim();
    const { imageBase64, imageMimeType } = parsed.data;
    const textOnly = message.length === 0;
    if (textOnly && !imageBase64) {
      return errorResponse(
        "Validation failed",
        "Send a message, an image, or both.",
        422
      );
    }

    let image: { mimeType: string; data: string } | undefined;
    if (imageBase64) {
      let buf: Buffer;
      try {
        buf = Buffer.from(imageBase64, "base64");
      } catch {
        return errorResponse("Validation failed", "Invalid image data", 422);
      }
      if (buf.length === 0 || buf.length > MAX_PLANT_IMAGE_BYTES) {
        return errorResponse(
          "Validation failed",
          `Image must be non-empty and at most ${MAX_PLANT_IMAGE_BYTES} bytes.`,
          422
        );
      }
      const sniffed = sniffImageMime(buf);
      if (!sniffed || !PLANT_IMAGE_MIME.has(sniffed)) {
        return errorResponse(
          "Validation failed",
          "Unsupported or invalid image format.",
          422
        );
      }
      if (imageMimeType?.trim()) {
        const declared = normalizeImageMimeType(imageMimeType.trim());
        if (PLANT_IMAGE_MIME.has(declared) && declared !== sniffed) {
          return errorResponse(
            "Validation failed",
            "Image content does not match declared type.",
            422
          );
        }
      }
      image = { mimeType: sniffed, data: buf.toString("base64") };
    }

    const systemInstruction = buildPlantCareChatSystemText({
      name: String(plant.name ?? ""),
      species: plant.species ? String(plant.species) : undefined,
      location: plant.location ? String(plant.location) : undefined,
      lightLevel: plant.lightLevel ? String(plant.lightLevel) : undefined,
      notes: plant.notes ? String(plant.notes) : undefined,
      careRequirements: plant.careRequirements
        ? String(plant.careRequirements)
        : undefined,
      careGuide: plant.careGuide
        ? {
            watering: plant.careGuide.watering
              ? String(plant.careGuide.watering)
              : undefined,
            sunlight: plant.careGuide.sunlight
              ? String(plant.careGuide.sunlight)
              : undefined,
            fertilizer: plant.careGuide.fertilizer
              ? String(plant.careGuide.fertilizer)
              : undefined,
            temperature: plant.careGuide.temperature
              ? String(plant.careGuide.temperature)
              : undefined,
          }
        : undefined,
    });

    const reply = await fetchGeminiPlantCareChatReply({
      systemInstruction,
      history,
      userText: message,
      image,
    });

    if (!reply) {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!key?.trim()) {
        return errorResponse(
          "Unavailable",
          "AI assistant is not configured (set GEMINI_API_KEY or GOOGLE_API_KEY on the server).",
          503
        );
      }
      return errorResponse(
        "Unavailable",
        "The AI could not produce a reply right now. Try again in a moment or shorten your message.",
        503
      );
    }

    return successResponse("Reply generated", { reply });
  } catch (err) {
    return handleServerError(err);
  }
}
