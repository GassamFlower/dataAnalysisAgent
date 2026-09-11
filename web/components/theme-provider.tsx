"use client";

import { useEffect } from "react";

import { useUIStore } from "@/lib/stores/ui-store";

/**
 * 主题 Provider。
 * 根据 uiStore 的 theme 切换 html 的 light / dark 类，保证 design token 生效。
 * remove 中保留 "sepia" 仅为清理历史遗留 class（v2.0 起该主题已下线）。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "sepia", "dark");
    root.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
