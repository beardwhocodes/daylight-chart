import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "daylight-chart-theme";

interface ThemeContextValue {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setStoredPreference] = useState<ThemePreference>(readPreference);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setSystem(query.matches ? "light" : "dark");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const theme = preference === "system" ? system : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    // Keeps the mobile browser chrome in step with the page background.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#141419" : "#fcfcfd");
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, next);
    setStoredPreference(next);
  }, []);

  const value = useMemo(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside a ThemeProvider");
  return context;
}
