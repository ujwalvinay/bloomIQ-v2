export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import {
  errorResponse,
  formatZodError,
  handleServerError,
  parseJsonBody,
  successResponse,
} from "@/lib/api";
import { signAccessToken, signRefreshToken, toSafeUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { setAuthCookies } from "@/lib/cookies";
import { loginBodySchema } from "@/lib/validators/auth";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const parsed = loginBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    const { email, password } = parsed.data;
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordHash"
    );
    if (!user?.passwordHash) {
      return errorResponse(
        "Unauthorized",
        "Invalid email or password",
        401
      );
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return errorResponse(
        "Unauthorized",
        "Invalid email or password",
        401
      );
    }
    const accessToken = signAccessToken(String(user._id), user.email);
    const refreshToken = signRefreshToken(
      String(user._id),
      user.refreshTokenVersion
    );
    const res = successResponse("Logged in", toSafeUser(user));
    setAuthCookies(res, accessToken, refreshToken);
    return res;
  } catch (err) {
    return handleServerError(err);
  }
}
