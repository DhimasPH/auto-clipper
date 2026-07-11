import { useState, useEffect } from "react";

export type Theme = "dark" | "light" | "system";

/** Theme state persisted to localStorage + applied to <html data-theme>. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("ac_theme") as Theme) || "system";
  });

  useEffect(() => {
    localStorage.setItem("ac_theme", theme);
    const root = document.documentElement;
    if (theme === "system") {
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      root.setAttribute("data-theme", prefersLight ? "light" : "dark");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return { theme, setTheme };
}
