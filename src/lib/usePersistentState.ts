'use client';

import { useEffect, useState } from 'react';

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const rawValue = window.localStorage.getItem(key);
        if (rawValue) setValue(JSON.parse(rawValue) as T);
      } catch {
        // Local UI preferences are best-effort.
      } finally {
        setHasLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [key]);

  useEffect(() => {
    if (!hasLoaded) return;

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local UI preferences are best-effort.
    }
  }, [hasLoaded, key, value]);

  return [value, setValue] as const;
}
