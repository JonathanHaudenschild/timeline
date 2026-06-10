'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'timeline-theme';

function applyTheme(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (pref === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }
}

export function useDarkMode() {
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const initial = stored ?? 'system';
    setPreference(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback((pref: ThemePreference) => {
    setPreference(pref);
    applyTheme(pref);
    if (pref === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  }, []);

  const cycle = useCallback(() => {
    setTheme(
      preference === 'system' ? 'dark'
      : preference === 'dark'  ? 'light'
      : 'system'
    );
  }, [preference, setTheme]);

  // Keep in sync if changed in another tab
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const pref = (e.newValue as ThemePreference | null) ?? 'system';
        setPreference(pref);
        applyTheme(pref);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { preference, setTheme, cycle };
}
