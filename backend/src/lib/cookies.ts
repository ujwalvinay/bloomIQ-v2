import type { NextResponse } from "next/server";
import { getEnv } from "./env";

export const ACCESS_TOKEN_COOKIE = "bloomiq_access";
export const REFRESH_TOKEN_COOKIE = "bloomiq_refresh";

const ACCESS_MAX_AGE_SEC = 15 * 60;
const REFRESH_MAX_AGE_SEC = 7 * 24 * 60 * 60;

function cookieBaseOptions() {
  const { NODE_ENV } = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: NODE_ENV === "production",
    path: "/",
  };
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): void {
  const base = cookieBaseOptions();
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...base,
    maxAge: ACCESS_MAX_AGE_SEC,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...base,
    maxAge: REFRESH_MAX_AGE_SEC,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  const base = cookieBaseOptions();
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...base, maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...base, maxAge: 0 });
}
