"use client";

import { useMutation } from "@tanstack/react-query";

import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { AuthUser } from "@/lib/api/auth";

function normalizeUser(user: AuthUser) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    plan: user.plan as "free" | "single" | "subscription",
  };
}

/**
 * 认证相关 mutations。
 *
 * 登录/注册/验证成功后自动写入 auth-store（同步 cookie + localStorage）。
 * 调用方只需处理跳转或提示。
 */
export function useAuthMutations() {
  const setAuth = useAuthStore((s) => s.setAuth);

  const emailLogin = useMutation({
    mutationFn: (params: { email: string; password: string }) =>
      authApi.emailLogin(params.email, params.password),
    onSuccess: ({ accessToken, user }) => {
      setAuth(normalizeUser(user), accessToken);
    },
  });

  const devLogin = useMutation({
    mutationFn: () => authApi.devLogin(),
    onSuccess: ({ accessToken, user }) => {
      setAuth(normalizeUser(user), accessToken);
    },
  });

  const register = useMutation({
    mutationFn: (params: {
      email: string;
      password: string;
      nickname?: string;
    }) => authApi.register(params.email, params.password, params.nickname),
  });

  const verifyEmail = useMutation({
    mutationFn: (params: { email: string; code: string }) =>
      authApi.verifyEmail(params.email, params.code),
    onSuccess: ({ accessToken, user }) => {
      setAuth(normalizeUser(user), accessToken);
    },
  });

  const resendCode = useMutation({
    mutationFn: (email: string) => authApi.resendCode(email),
  });

  const forgotPassword = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });

  const resetPassword = useMutation({
    mutationFn: (params: { token: string; newPassword: string }) =>
      authApi.resetPassword(params.token, params.newPassword),
  });

  return {
    emailLogin,
    devLogin,
    register,
    verifyEmail,
    resendCode,
    forgotPassword,
    resetPassword,
  };
}

/**
 * 退出登录：通知 BFF 清除 httpOnly refresh token，再清除本地状态与 cookie。
 */
export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return async () => {
    try {
      await authApi.logout();
    } catch {
      // 即使 BFF 清除失败也继续清理本地状态
    }
    logout();
    window.location.href = "/login";
  };
}
