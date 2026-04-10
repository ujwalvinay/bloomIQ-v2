import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { ApiResponse } from "@/types/api";

export function formatZodError(error: ZodError): string {
  return error.errors
    .map((e) => `${e.path.join(".") || "root"}: ${e.message}`)
    .join("; ");
}

export function successResponse<T>(
  message: string,
  data: T,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
      error: null,
    },
    { status }
  );
}

export function errorResponse(
  message: string,
  error: string,
  status: number,
  data: null = null
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      message,
      data,
      error,
    },
    { status }
  );
}

export async function parseJsonBody<T>(
  request: Request
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const text = await request.text();
    if (!text.trim()) {
      return { ok: true, data: {} as T };
    }
    const data = JSON.parse(text) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

export function handleServerError(err: unknown): NextResponse<ApiResponse<null>> {
  console.error("[BloomIQ API]", err);
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred";
  return errorResponse("Internal server error", message, 500);
}
