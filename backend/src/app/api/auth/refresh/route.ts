export const dynamic = "force-dynamic";

import {
  errorResponse,
  handleServerError,
  successResponse,
} from "@/lib/api";
import {
  getRefreshTokenFromRequest,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { clearAuthCookies, setAuthCookies } from "@/lib/cookies";
import User from "@/models/User";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const token = getRefreshTokenFromRequest(request);
    if (!token) {
      return errorResponse("Unauthorized", "Missing refresh token", 401);
    }
    let payload: { sub: string; tv: number };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      const res = errorResponse("Unauthorized", "Invalid refresh token", 401);
      clearAuthCookies(res);
      return res;
    }
    const user = await User.findById(payload.sub).select(
      "email refreshTokenVersion"
    );
    if (!user || user.refreshTokenVersion !== payload.tv) {
      const res = errorResponse(
        "Unauthorized",
        "Refresh token is no longer valid",
        401
      );
      clearAuthCookies(res);
      return res;
    }
    const accessToken = signAccessToken(String(user._id), user.email);
    const refreshToken = signRefreshToken(
      String(user._id),
      user.refreshTokenVersion
    );
    const res = successResponse("Tokens refreshed", {
      ok: true as const,
    });
    setAuthCookies(res, accessToken, refreshToken);
    return res;
  } catch (err) {
    return handleServerError(err);
  }
}
