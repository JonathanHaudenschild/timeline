'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useDarkMode, type ThemePreference } from '@/lib/useDarkMode';
import { cn } from '@/lib/cn';

const labels: Record<ThemePreference, string> = {
  system: 'Theme: system (click for dark)',
  dark:   'Theme: dark (click for light)',
  light:  'Theme: light (click for system)',
};

export function DarkModeToggle({ className }: { className?: string }) {
  const { preference, cycle } = useDarkMode();

  return (
    <button
      type="button"
      className={cn(
        'icon-button tertiary',
        className,
      )}
      onClick={cycle}
      aria-label={labels[preference]}
      title={labels[preference]}
    >
      {preference === 'dark'   ? <Moon   size={16} aria-hidden="true" /> :
       preference === 'light'  ? <Sun    size={16} aria-hidden="true" /> :
                                 <Monitor size={16} aria-hidden="true" />}
    </button>
  );
}
