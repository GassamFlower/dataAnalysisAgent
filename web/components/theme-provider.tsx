"use client";

import { useEffect } from "react";

import { useUIStore } from "@/lib/stores/ui-store";

/**
 * 主题 Provider。
 * 根据 uiStore 的 theme 切换 html 的 light / sepia / dark 类，
 * 保证 design token 的亮暗/复古中间态生效。
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
