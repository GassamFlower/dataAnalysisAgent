"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/ui-store";

/**
 * 主题切换按钮。
 * 用于验证 design token 的亮色 / 暗色模式切换。
 */
export function ThemeToggle() {
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  const toggle = () => setTheme(theme === "light" ? "dark" : "light");

  return (
    <Button variant="outline" size="icon" onClick={toggle} aria-label="切换主题">
      {theme === "light" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
