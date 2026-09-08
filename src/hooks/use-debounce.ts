"use client";

import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// 150ms optimized debounce for 0.2s target
export function useDebouncedValue<T>(value: T, delay = 150): T {
  return useDebounce(value, delay);
}
