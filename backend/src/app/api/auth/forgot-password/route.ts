export const dynamic = "force-dynamic";

import {
  errorResponse,
  formatZodError,
  handleServerError,
  parseJsonBody,
  successResponse,
} from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { buildPasswordResetUrl, sendPasswordResetEmail } from "@/lib/mail";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from "@/lib/password-reset-token";
import { forgotPasswordBodySchema } from "@/lib/validators/auth";
import User from "@/models/User";

const RESET_TTL_MS = 60 * 60 * 1000;

const PUBLIC_MESSAGE =
  "If an account exists for that email, we’ve sent reset instructions.";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const parsed = forgotPasswordBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }

    const email = parsed.data.email.toLowerCase();
    const user = await User.findOne({ email });

    if (user) {
      const token = generatePasswordResetToken();
      const tokenHash = hashPasswordResetToken(token);
      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpiresAt = new Date(Date.now() + RESET_TTL_MS);
      await user.save();

      const url = buildPasswordResetUrl(token);
      try {
        await sendPasswordResetEmail(user.email, url);
      } catch (err) {
        console.error("[BloomIQ] Password reset email error:", err);
        return errorResponse(
          "Service unavailable",
          "Could not send reset email. Try again later.",
          503
        );
      }
    }

    return successResponse(PUBLIC_MESSAGE, { ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
