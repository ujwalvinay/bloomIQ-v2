import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import type { Types } from "mongoose";
import User from "@/models/User";
import type { AccessTokenPayload, RefreshTokenPayload, SafeUser } from "@/types/auth";
import { connectToDatabase } from "./db";
import { getEnv } from "./env";
import { errorResponse } from "./api";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./cookies";

const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";

export function signAccessToken(userId: string, email: string): string {
  const secret = getEnv().JWT_ACCESS_SECRET;
  const payload: AccessTokenPayload = { sub: userId, email };
  return jwt.sign(payload, secret, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(userId: string, tokenVersion: number): string {
  const secret = getEnv().JWT_REFRESH_SECRET;
  const payload: RefreshTokenPayload = { sub: userId, tv: tokenVersion };
  return jwt.sign(payload, secret, { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = getEnv().JWT_ACCESS_SECRET;
  return jwt.verify(token, secret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const secret = getEnv().JWT_REFRESH_SECRET;
  return jwt.verify(token, secret) as RefreshTokenPayload;
}

export function toSafeUser(doc: {
  _id: Types.ObjectId | string;
  name: string;
  email: string;
  timezone: string;
  notificationEnabled: boolean;
  hasAvatar?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}): SafeUser {
  const hasAvatar = Boolean(doc.hasAvatar);
  return {
    _id: String(doc._id),
    name: doc.name,
    email: doc.email,
    timezone: doc.timezone,
    notificationEnabled: doc.notificationEnabled,
    avatarUrl: hasAvatar ? "/api/auth/me/avatar" : null,
    createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: doc.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function getAuthUserFromRequest(
  request: NextRequest
): Promise<SafeUser | null> {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    await connectToDatabase();
    const user = await User.findById(payload.sub).select(
      "name email timezone notificationEnabled hasAvatar createdAt updatedAt"
    );
    if (!user) return null;
    return toSafeUser(user);
  } catch {
    return null;
  }
}

export async function requireAuth(
  request: NextRequest
): Promise<{ user: SafeUser } | NextResponse> {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return errorResponse("Unauthorized", "Authentication required", 401);
  }
  return { user };
}

export function getRefreshTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}
