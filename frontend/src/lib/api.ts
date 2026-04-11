export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  error: string | null;
};

export async function apiGet<T>(path: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(path, { credentials: "include" });
  const json = (await res.json()) as ApiEnvelope<T>;
  return json;
}

export async function apiPost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<ApiEnvelope<T>> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  return json;
}
