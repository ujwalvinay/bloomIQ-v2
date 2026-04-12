export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import {
  errorResponse,
  formatZodError,
  handleServerError,
  parseJsonBody,
  successResponse,
} from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { hashPasswordResetToken } from "@/lib/password-reset-token";
import { resetPasswordBodySchema } from "@/lib/validators/auth";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const parsed = resetPasswordBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }

    const { token, password } = parsed.data;
    const tokenHash = hashPasswordResetToken(token);

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("+passwordResetTokenHash +passwordResetExpiresAt");

    if (!user) {
      return errorResponse(
        "Invalid token",
        "This reset link is invalid or has expired. Request a new one.",
        400
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const nextVersion = user.refreshTokenVersion + 1;

    await User.findByIdAndUpdate(user._id, {
      $set: { passwordHash, refreshTokenVersion: nextVersion },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    });

    return successResponse("Your password has been updated.", { ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
