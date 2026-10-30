'use client';

import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' };
  return (
    <button
      onClick={() => setTheme(next[theme])}
      className="p-2 rounded-lg hover:bg-muted text-sm"
      title={`Theme: ${theme}`}
    >
      {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️'}
    </button>
  );
}
