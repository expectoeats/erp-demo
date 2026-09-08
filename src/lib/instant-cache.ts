"use client";
// Synchronous instant cache — read in useState initializer for 0ms flash
export function getInstantCache<T>(key: string, maxAgeMs = 30000): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > maxAgeMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data as T;
  } catch { return null; }
}

export function setInstantCache(key: string, data: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export function clearInstantCache(prefix?: string) {
  try {
    if (!prefix) { sessionStorage.clear(); return; }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) sessionStorage.removeItem(k);
    }
  } catch {}
}
