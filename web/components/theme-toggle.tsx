"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useUIStore,
  type UITheme,
} from "@/lib/stores/ui-store";

/**
 * 主题切换按钮。
 * light ⇄ dark 两态循环切换，并给出对应的图标提示。
 */
export function ThemeToggle() {
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const cycle: Record<UITheme, UITheme> = {
    light: "dark",
    dark: "light",
  };

  const next = cycle[theme];

  // 首帧与 SSR 保持一致（Sun），mount 后再按持久化主题切换图标，避免水合不一致
  const Icon = !mounted ? Sun : theme === "dark" ? Moon : Sun;

  const ariaLabel = !mounted
    ? "切换主题"
    : theme === "light"
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