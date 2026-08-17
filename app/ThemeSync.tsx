"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * ThemeSync — re-asserts the user's stored theme on every route change.
 *
 * The theme lives on <html data-theme>. The layout boot script restores
 * it from localStorage on a full page load, and toggling persists it. But
 * if a full reload ever lands while the in-memory data-theme and the
 * stored value diverge, a page could briefly show the wrong theme (Jack:
 * "clicked into messages and it went light mode"). Mounting this in
 * AppShell makes every signed-in navigation deterministically apply the
 * stored preference (default light), so the theme can never flip between
 * pages again.
 */
export function ThemeSync() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const saved = localStorage.getItem("syncedin-theme");
      const theme = saved === "dark" ? "dark" : "light";
      if (document.documentElement.dataset.theme !== theme) {
        document.documentElement.dataset.theme = theme;
      }
    } catch {
      /* storage blocked — leave whatever the boot script set */
    }
  }, [pathname]);
  return null;
}
