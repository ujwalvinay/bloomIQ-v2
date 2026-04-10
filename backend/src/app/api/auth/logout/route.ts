export const dynamic = "force-dynamic";

import { handleServerError, successResponse } from "@/lib/api";
import { verifyRefreshToken, getRefreshTokenFromRequest } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { clearAuthCookies } from "@/lib/cookies";
import User from "@/models/User";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const token = getRefreshTokenFromRequest(request);
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await User.findByIdAndUpdate(payload.sub, {
          $inc: { refreshTokenVersion: 1 },
        });
      } catch {
        // still clear cookies
      }
    }
    const res = successResponse("Logged out", { ok: true as const });
    clearAuthCookies(res);
    return res;
  } catch (err) {
    return handleServerError(err);
  }
}
