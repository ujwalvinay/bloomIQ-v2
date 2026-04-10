export const dynamic = "force-dynamic";

import { errorResponse, handleServerError, successResponse } from "@/lib/api";
import { getAuthUserFromRequest } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
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
