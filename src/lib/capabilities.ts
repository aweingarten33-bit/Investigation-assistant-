import { useEffect, useState } from "react";
import { callApi } from "@/lib/api";

// What the server's configured AI provider can do. Fetched once per page load.
// On any failure, treat web search as unavailable rather than offering a
// feature that would only produce an error.
type Capabilities = { webSearch: boolean };

let cached: Promise<Capabilities> | null = null;

export function loadCapabilities(): Promise<Capabilities> {
  if (!cached) {
    cached = callApi<Capabilities>("investigation-toolkit", { mode: "capabilities" }).then(({ data }) => ({
      webSearch: data?.webSearch === true,
    }));
  }
  return cached;
}

export function resetCapabilitiesForTests() {
  cached = null;
}

// null while loading.
export function useWebSearchAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void loadCapabilities().then((caps) => {
      if (active) setAvailable(caps.webSearch);
    });
    return () => {
      active = false;
    };
  }, []);
  return available;
}
