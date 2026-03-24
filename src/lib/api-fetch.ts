import { extractApiError } from "./client-error";

export type ApiFetchResult<T> = { ok: true; data: T } | { ok: false; status: number; error: Error };

export async function apiFetch<T>(
  url: string,
  opts?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  }
): Promise<ApiFetchResult<T>> {
  const method = opts?.method ?? "GET";
  const hasBody = opts?.body !== undefined;

  try {
    const res = await fetch(url, {
      method,
      headers: hasBody ? { "Content-Type": "application/json" } : {},
      body: hasBody ? JSON.stringify(opts!.body) : undefined,
    });

    if (!res.ok) {
      const message = await extractApiError(res, "An unexpected error occurred.");
      return { ok: false, status: res.status, error: new Error(message) };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: new Error("Network error", { cause: e }),
    };
  }
}
