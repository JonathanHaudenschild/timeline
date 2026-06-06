'use client';

import { useEffect, useState } from 'react';

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const rawValue = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (rawValue !== null) return JSON.parse(rawValue) as T;
    } catch {
      // Local UI preferences are best-effort.
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local UI preferences are best-effort.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
