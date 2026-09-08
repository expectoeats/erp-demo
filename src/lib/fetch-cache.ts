// Global fetch cache for 0.2s target — 5-10s TTL with SWR
type CacheEntry<T> = { data: T; ts: number; promise?: Promise<T> };
const cache = new Map<string, CacheEntry<unknown>>();
const TTL = 5000; // 5s fresh, stale-while-revalidate
const STALE = 15000; // 15s max stale

export async function cachedFetch<T>(url: string, init?: RequestInit & { ttl?: number; revalidate?: boolean }): Promise<T> {
  const key = url + JSON.stringify(init?.method ?? "GET");
  const ttl = init?.ttl ?? TTL;
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry && now - entry.ts < ttl) {
    return entry.data;
  }
  if (entry && entry.promise && now - entry.ts < STALE) {
    // SWR: return stale while revalidating
    entry.promise.then((d) => cache.set(key, { data: d, ts: Date.now() })).catch(() => {});
    return entry.data;
  }

  const promise = fetch(url, { ...init, cache: "no-store" } as RequestInit)
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d as T;
    });

  if (entry) {
    cache.set(key, { ...entry, promise: promise as unknown as Promise<unknown> });
    // try fast revalidate without blocking
    promise.then((d) => cache.set(key, { data: d, ts: Date.now() })).catch(() => {});
    return entry.data;
  }

  const data = await promise;
  cache.set(key, { data, ts: now });
  return data;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) { cache.clear(); return; }
  for (const k of cache.keys()) if (k.includes(prefix)) cache.delete(k);
}

export function prefetch(url: string) {
  cachedFetch(url).catch(() => {});
}
