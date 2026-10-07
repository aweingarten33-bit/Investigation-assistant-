import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { clearSessionState } from "@/lib/session-state";

// Session state is module-level by design; reset it so one test's case never
// leaks into the next.
afterEach(() => {
  clearSessionState();
});

if (typeof window !== "undefined") {
  // jsdom doesn't implement scrolling.
  window.scrollTo = () => {};
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
