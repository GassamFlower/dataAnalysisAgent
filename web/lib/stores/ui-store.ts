"use client";

import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  theme: "light" | "dark";

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: UIState["theme"]) => void;
}

/**
 * UI 状态管理。
 * 侧边栏、主题等全局 UI 状态。
 */
export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  theme: "light",

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => set({ theme }),
}));
