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
import { toSafeUser } from "@/lib/auth";
import { signupBodySchema } from "@/lib/validators/auth";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const parsed = signupBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }
    const { name, email, password } = parsed.data;
    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      return errorResponse("Conflict", "Email already registered", 409);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
    });
    return successResponse(
      "Account created",
      toSafeUser(user),
      201
    );
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return errorResponse("Conflict", "Email already registered", 409);
    }
    return handleServerError(err);
  }
}
