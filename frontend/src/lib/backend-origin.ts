/**
 * API origin for browser requests that should hit the backend app directly.
 * Embedded plant photos are loaded with `<img src=…>`; proxying binary bodies through
 * the frontend Next.js rewrite can fail while JSON `/api` calls still work, so we use
 * an absolute same-site URL when we know the backend origin (dev default matches
 * `frontend/next.config.mjs` → `API_PROXY_TARGET`).
 */
export function browserBackendOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_PROXY_TARGET?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return "";
}

/** Prefix a same-origin API path with the backend origin when configured (or in dev). */
export function absoluteApiUrl(path: string): string {
  const origin = browserBackendOrigin();
  if (!origin) return path;
  if (path.startsWith("/")) return `${origin}${path}`;
  return `${origin}/${path}`;
}
