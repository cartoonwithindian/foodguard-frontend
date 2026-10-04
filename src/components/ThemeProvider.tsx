"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeClass(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
}

function getInitialTheme(): Theme {
  // FoodGuard is designed as a light-mode product by default. Users can still
  // explicitly select a theme from the existing toggle when desired.
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(getSystemTheme);
  const isSystem = theme === "system";

  // Derive resolved theme from theme + systemTheme
  const resolvedTheme = useMemo(
    () => (isSystem ? systemTheme : theme as "light" | "dark"),
    [isSystem, systemTheme, theme],
  );

  // Sync DOM class and localStorage when resolved theme changes
  const resolved = resolvedTheme;
  const prevResolvedRef = useRef(resolved);

  useEffect(() => {
    if (prevResolvedRef.current !== resolved) {
      applyThemeClass(resolved);
      prevResolvedRef.current = resolved;
    }
    localStorage.setItem("theme", theme);
  }, [resolved, theme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (!isSystem) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemTheme(getSystemTheme());
    // Apply initial
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [isSystem]);

  // Apply initial class on mount
  useEffect(() => {
    applyThemeClass(resolved);
    
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "system" as Theme,
      resolvedTheme: "light" as const,
      setTheme: () => {},
    };
  }
  return ctx;
}
