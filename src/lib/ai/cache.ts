import { createHash } from "node:crypto";

type Entry = { value: unknown; expiresAt: number };

const MAX_ENTRIES = 100;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

const store = new Map<string, Entry>();

export function cacheKey(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  // Refresh recency so the Map behaves like a tiny LRU.
  store.delete(key);
  store.set(key, entry);
  return entry.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheClear(): void {
  store.clear();
}
