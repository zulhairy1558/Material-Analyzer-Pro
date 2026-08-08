"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppStore((s) => s.theme);
  const isHydrated = useAppStore((s) => s._isHydrated);

  // Apply theme to <html> on mount + whenever theme changes
  useEffect(() => {
    const apply = (mode: "light" | "dark" | "system") => {
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const isDark = mode === "dark" || (mode === "system" && systemDark);
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };

    apply(theme);

    // If system, listen for OS changes
    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("system");
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [theme]);

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    void useAppStore.getState().hydrateFromIDB();
  }, []);

  // Show loading screen while hydrating from IndexedDB
  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
