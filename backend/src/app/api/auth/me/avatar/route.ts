export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import {
  errorResponse,
  handleServerError,
  parseJsonBody,
  successResponse,
} from "@/lib/api";
import { requireAuth, toSafeUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  MAX_PLANT_IMAGE_BYTES,
  PLANT_IMAGE_MIME,
  normalizeImageMimeType,
  normalizePlantImageBuffer,
  sniffImageMime,
} from "@/lib/plant-image";
import User from "@/models/User";

const SELECT_SAFE =
  "name email timezone notificationEnabled hasAvatar createdAt updatedAt";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const doc = (await User.findById(auth.user._id)
      .select("+avatarData +avatarMimeType")
      .lean()) as {
      avatarData?: unknown;
      avatarMimeType?: string;
    } | null;

    if (!doc) {
      return errorResponse("Not found", "User not found", 404);
    }

    const buf = normalizePlantImageBuffer(doc.avatarData);
    if (!buf?.length) {
      return errorResponse("Not found", "Avatar not found", 404);
    }

    const mime =
      typeof doc.avatarMimeType === "string" &&
      PLANT_IMAGE_MIME.has(normalizeImageMimeType(doc.avatarMimeType))
        ? normalizeImageMimeType(doc.avatarMimeType)
        : sniffImageMime(buf) ?? "image/jpeg";

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=300",
      },
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

    let buf: Buffer | null = null;
    let declaredMime: string | null = null;

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("avatar");
      if (file instanceof Blob && file.size > 0) {
        if (file.size > MAX_PLANT_IMAGE_BYTES) {
          return errorResponse(
            "Payload too large",
            "Image must be 3MB or smaller",
            413
          );
        }
        buf = Buffer.from(await file.arrayBuffer());
        if (file.type && PLANT_IMAGE_MIME.has(normalizeImageMimeType(file.type))) {
          declaredMime = normalizeImageMimeType(file.type);
        }
      }
    } else {
      const raw = await parseJsonBody<{
        imageBase64?: string;
        imageMimeType?: string;
      }>(request);
      if (!raw.ok) {
        return errorResponse("Invalid request", raw.error, 400);
      }
      const b64 =
        typeof raw.data.imageBase64 === "string"
          ? raw.data.imageBase64.trim()
          : "";
      if (!b64) {
        return errorResponse("Validation failed", "imageBase64 is required", 422);
      }
      try {
        buf = Buffer.from(b64, "base64");
      } catch {
        return errorResponse("Bad request", "Invalid base64 image data", 400);
      }
      if (buf.length > MAX_PLANT_IMAGE_BYTES) {
        return errorResponse(
          "Payload too large",
          "Image must be 3MB or smaller",
          413
        );
      }
      const mt = raw.data.imageMimeType;
      if (
        typeof mt === "string" &&
        PLANT_IMAGE_MIME.has(normalizeImageMimeType(mt))
      ) {
        declaredMime = normalizeImageMimeType(mt);
      }
    }

    if (!buf?.length) {
      return errorResponse(
        "Validation failed",
        "avatar file is required (multipart field \"avatar\") or JSON imageBase64",
        422
      );
    }

    const sniffed = sniffImageMime(buf);
    const normalizedDeclared =
      declaredMime && PLANT_IMAGE_MIME.has(normalizeImageMimeType(declaredMime))
        ? normalizeImageMimeType(declaredMime)
        : null;
    const mime = sniffed ?? normalizedDeclared;
    if (!mime) {
      return errorResponse(
        "Bad request",
        "Image must be JPEG, PNG, WebP, or GIF",
        400
      );
    }

    await User.findByIdAndUpdate(auth.user._id, {
      $set: {
        avatarData: buf,
        avatarMimeType: mime,
        hasAvatar: true,
      },
    });

    const fresh = await User.findById(auth.user._id).select(SELECT_SAFE);
    if (!fresh) {
      return errorResponse("Not found", "User not found", 404);
    }

    return successResponse("Avatar updated", toSafeUser(fresh));
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    await User.findByIdAndUpdate(auth.user._id, {
      $unset: { avatarData: 1, avatarMimeType: 1 },
      $set: { hasAvatar: false },
    });

    const fresh = await User.findById(auth.user._id).select(SELECT_SAFE);
    if (!fresh) {
      return errorResponse("Not found", "User not found", 404);
    }

    return successResponse("Avatar removed", toSafeUser(fresh));
  } catch (err) {
    return handleServerError(err);
  }
}
