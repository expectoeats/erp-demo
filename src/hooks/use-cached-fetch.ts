"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { cachedFetch, invalidateCache } from "@/lib/fetch-cache";

interface Opts {
  ttl?: number;
  deps?: unknown[];
  enabled?: boolean;
}

export function useCachedFetch<T>(url: string | null, opts: Opts = {}) {
  const { ttl = 5000, enabled = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url && enabled);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (!url || !enabled) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const d = await cachedFetch<T>(url, { signal: ac.signal, ttl } as RequestInit & { ttl: number });
      if (!ac.signal.aborted) setData(d);
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      setError(e as Error);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [url, ttl, enabled]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  return { data, loading, error, refetch, invalidate: () => invalidateCache(url ?? undefined) };
}
