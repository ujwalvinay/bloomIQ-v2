export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
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
import { clearAuthCookies } from "@/lib/cookies";
import { connectToDatabase } from "@/lib/db";
import { changePasswordBodySchema } from "@/lib/validators/auth";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const parsed = changePasswordBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    const userId = new Types.ObjectId(auth.user._id);

    const user = await User.findById(userId).select("+passwordHash");
    if (!user?.passwordHash) {
      return errorResponse("Unauthorized", "Account not found.", 401);
    }

    const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentOk) {
      return errorResponse(
        "Unauthorized",
        "The current password is incorrect.",
        401
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const nextVersion = user.refreshTokenVersion + 1;

    await User.findByIdAndUpdate(userId, {
      $set: {
        passwordHash,
        refreshTokenVersion: nextVersion,
      },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    });

    const res = successResponse("Password updated. Please sign in again.", {
      ok: true as const,
    });
    clearAuthCookies(res);
    return res;
  } catch (err) {
    return handleServerError(err);
  }
}
