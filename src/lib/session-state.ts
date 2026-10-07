import { useCallback, useState, type SetStateAction } from "react";

// In-memory session state that survives in-app navigation (Report Generator ->
// Toolkit -> back) but not a reload. Pages unmount on navigation, so plain
// useState lost the uploaded notes, the finished report, and the generated
// plan. Nothing here touches browser storage or the server: the app stays
// stateless, and the Word export remains the record.

const store = new Map<string, unknown>();

function resolveInitial<T>(initial: T | (() => T)): T {
  return typeof initial === "function" ? (initial as () => T)() : initial;
}

export function useSessionState<T>(key: string, initial: T | (() => T)) {
  const [entry, setEntry] = useState(() => ({
    key,
    value: store.has(key) ? (store.get(key) as T) : resolveInitial(initial),
  }));

  // A new key (e.g. a planner for different case inputs) starts from whatever
  // that key has stored, not from the previous key's value.
  let current = entry;
  if (entry.key !== key) {
    current = { key, value: store.has(key) ? (store.get(key) as T) : resolveInitial(initial) };
    setEntry(current);
  }

  const setValue = useCallback((next: SetStateAction<T>) => {
    setEntry((prev) => {
      const value = typeof next === "function" ? (next as (prev: T) => T)(prev.value) : next;
      store.set(prev.key, value);
      return { key: prev.key, value };
    });
  }, []);

  return [current.value, setValue] as const;
}

export function clearSessionState(prefix = "") {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
