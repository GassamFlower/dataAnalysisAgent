"use client";

import { create } from "zustand";

export type UITheme = "light" | "dark";

/** 主题持久化 key */
const THEME_KEY = "dsh-ui-theme";

/** 合法主题集合（v2.0 起收敛为 light / dark 两态，sepia 已下线） */
const THEMES: UITheme[] = ["light", "dark"];

function isTheme(value: unknown): value is UITheme {
  return typeof value === "string" && (THEMES as string[]).includes(value);
}

/** 读取持久化主题；无则跟随系统 */
function initialTheme(): UITheme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

interface UIState {
  sidebarOpen: boolean;
  theme: UITheme;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: UITheme) => void;
}

/**
 * UI 状态管理。
 * 侧边栏、主题等全局 UI 状态。
 * 主题支持 light / dark 两态，持久化到 localStorage，
 * 首次访问跟随系统深色偏好。
 * 历史遗留的 "sepia" 值不在 THEMES 中，isTheme 会判否并回落到系统偏好。
 */
export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  theme: initialTheme(),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },
}));