import { HttpError } from "./errors.js";

// Every AI provider call must have a hard upper bound. Without one, a
// stalled upstream connection hangs the request indefinitely with nothing
// to ever convert it into a visible error — from the user's side, a hang
// and a real failure are indistinguishable. 90s comfortably covers a slow
// classify/report call (including search-grounded research) while still
// failing fast enough that a genuinely stuck request surfaces as an error
// instead of an endless spinner.
const DEFAULT_TIMEOUT_MS = 90_000;

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new HttpError(`The AI provider did not respond within ${Math.round(timeoutMs / 1000)} seconds. Please try again.`, 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
