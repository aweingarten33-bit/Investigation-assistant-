// Thin fetch wrapper for the app's own API routes (server/routes/*.js).
// Same-origin — no client credentials, no CORS — so this is just JSON in,
// JSON out. Mirrors the { data, error } shape callers were already written
// against so migrating off supabase.functions.invoke stayed mechanical.
export async function callApi<T = unknown>(
  route: "analyze-report" | "investigation-toolkit",
  body: unknown,
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const res = await fetch(`/api/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json && typeof json.error === "string" ? json.error : `Request failed (${res.status})`;
      return { data: null, error: new Error(message) };
    }
    return { data: json, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error("Network error") };
  }
}
