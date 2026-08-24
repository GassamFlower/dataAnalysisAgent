"use client";

import { Moon, Sun, Sunrise } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useUIStore,
  type UITheme,
} from "@/lib/stores/ui-store";

/**
 * 主题切换按钮。
 * light → sepia → dark 循环切换，并给出对应的图标提示。
 */
export function ThemeToggle() {
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  const cycle: Record<UITheme, UITheme> = {
    light: "sepia",
    sepia: "dark",
    dark: "light",
  };

  const next = cycle[theme];

  const Icon =
    theme === "dark" ? Moon : theme === "sepia" ? Sunrise : Sun;

  const ariaLabel =
    theme === "light"
      ? "切换到复古棕榈墨主题"
      : theme === "sepia"
        ? "切换到暗色主题"
        : "切换到亮色主题";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}