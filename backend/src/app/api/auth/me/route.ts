export const dynamic = "force-dynamic";

import {
  errorResponse,
  formatZodError,
  handleServerError,
  successResponse,
} from "@/lib/api";
import { getAuthUserFromRequest, toSafeUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { updateMeBodySchema } from "@/lib/validators/auth";
import User from "@/models/User";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return errorResponse("Unauthorized", "Authentication required", 401);
    }
    return successResponse("Current user", user);
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();
    const current = await getAuthUserFromRequest(request);
    if (!current) {
      return errorResponse("Unauthorized", "Authentication required", 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Bad request", "Invalid JSON body", 400);
    }

    const parsed = updateMeBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Validation error", formatZodError(parsed.error), 400);
    }

    const doc = await User.findById(current._id);
    if (!doc) {
      return errorResponse("Not found", "User not found", 404);
    }

    if (parsed.data.name !== undefined) doc.name = parsed.data.name;
    if (parsed.data.timezone !== undefined) doc.timezone = parsed.data.timezone;
    if (parsed.data.notificationEnabled !== undefined) {
      doc.notificationEnabled = parsed.data.notificationEnabled;
    }
    await doc.save();

    const fresh = await User.findById(current._id).select(
      "name email timezone notificationEnabled hasAvatar createdAt updatedAt"
    );
    if (!fresh) {
      return errorResponse("Not found", "User not found", 404);
    }
    return successResponse("Profile updated", toSafeUser(fresh));
  } catch (err) {
    return handleServerError(err);
  }
}
