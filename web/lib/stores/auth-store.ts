"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  nickname: string;
  avatar?: string;
  plan: "free" | "single" | "subscription";
  planExpiresAt?: string;
}

const AUTH_COOKIE_NAME = "auth-token";
// cookie 作为"已登录"标记随 refresh token 保留 7 天，供 middleware 路由保护；
// 实际 access token 15 分钟过期后由 client.ts 自动续期。
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

function setAuthCookie(token: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
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
        set({ accessToken });
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
    }
  )
);
