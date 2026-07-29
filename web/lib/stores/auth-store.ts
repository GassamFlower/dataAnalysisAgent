"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME } from "@/lib/auth-cookies";

interface User {
  id: string;
  nickname: string;
  avatar?: string;
  plan: "free" | "single" | "subscription";
  planExpiresAt?: string;
}

function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "https:";
}

function setAuthCookie(token: string): void {
  if (typeof document === "undefined") return;
  const secure = isSecureContext() ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  const secure = isSecureContext() ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
  updatePlan: (plan: User["plan"], expiresAt?: string) => void;
}

/**
 * 认证状态管理。
 * 只持久化 access token 到 localStorage；refresh token 由 BFF 以 httpOnly cookie 持有。
 * access token 同时写入 cookie 供 middleware 做路由保护。
 *
 * 注意：`isAuthenticated` 不持久化（避免与后端 token 真实有效性脱节），
 * 而是在 rehydrate 时根据 `accessToken` 推导。
 * 否则刷新页面后会出现 `isAuthenticated=false` 但 cookie/localStorage 中仍有 token 的不一致状态，
 * 触发 AppShell 路由守卫误跳转到 /login（"刷新又要登录"现象的根因）。
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        setAuthCookie(accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      setAccessToken: (accessToken) => {
        setAuthCookie(accessToken);
        set({ accessToken, isAuthenticated: true });
      },

      logout: () => {
        clearAuthCookie();
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      updatePlan: (plan, expiresAt) =>
        set((state) => ({
          user: state.user
            ? { ...state.user, plan, planExpiresAt: expiresAt }
            : null,
        })),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
      // rehydrate 后根据 accessToken 推导 isAuthenticated，保证刷新页面后路由守卫不会误跳转
      onRehydrateStorage: () => (state) => {
        if (state && state.accessToken) {
          state.isAuthenticated = true;
        }
      },
    }
  )
);
