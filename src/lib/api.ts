// Thin fetch wrapper for the app's own API routes (server/routes/*.js).
// Same-origin — no client credentials, no CORS — so this is just JSON in/out.
export async function callApi<T = unknown>(
  route: "analyze-report" | "investigation-toolkit",
  body: unknown,
  options?: { signal?: AbortSignal },
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const res = await fetch(`/api/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json && typeof json.error === "string" ? json.error : `Request failed (${res.status})`;
      return { data: null, error: new Error(message) };
    }
    return { data: json, error: null };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { data: null, error: new Error("Request cancelled") };
    }
    return { data: null, error: e instanceof Error ? e : new Error("Network error") };
  }
}
