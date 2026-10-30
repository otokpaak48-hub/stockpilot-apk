'use client';

/**
 * StockPilot — Theme Provider (dark / light / system)
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    const saved = (localStorage.getItem('sp_theme') as Theme) ?? 'system';
    setThemeState(saved);
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem('sp_theme', t);
    setThemeState(t);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
