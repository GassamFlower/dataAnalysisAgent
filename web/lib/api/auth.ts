/**
 * 认证 API 客户端。
 *
 * 认证接口统一走 Next.js BFF 路由 `/api/auth/*`，原因：
 * 1. 测试账号登录（dev-login）仅通过 BFF 暴露，不直接对外。
 * 2. 微信授权回调需要在 BFF 层处理 cookie / localStorage 写入。
 * 3. 邮箱注册/登录/找回密码等接口与后端字段映射可在 BFF 层统一收敛。
 */

import { ApiError } from "./client";

export interface AuthUser {
  id: string;
  nickname: string;
  email?: string;
  avatar?: string;
  plan: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface MessageResponse {
  message: string;
}

/** BFF 统一响应结构 `{ code, message, data }` */
interface BffResponse<T> {
  code: number;
  message: string;
  data: T;
}

async function bffRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const json = (await res.json().catch(() => ({
    code: res.status * 100 || 50000,
    message: res.statusText || "请求失败",
  }))) as BffResponse<T> | { message?: string; detail?: string };

  if (!res.ok) {
    const msg =
      (json as BffResponse<T>).message ??
      (json as { message?: string }).message ??
      (json as { detail?: string }).detail ??
      "请求失败";
    throw new ApiError(
      (json as BffResponse<T>).code ?? res.status * 100,
      msg
    );
  }

  return (json as BffResponse<T>).data;
}

export const authApi = {
  /** 邮箱登录 */
  emailLogin: (email: string, password: string): Promise<AuthResponse> =>
    bffRequest<AuthResponse>("/api/auth/email-login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  /** 邮箱注册：创建用户并发送验证码 */
  register: (
    email: string,
    password: string,
    nickname?: string,
    agreedTerms?: boolean
  ): Promise<MessageResponse> =>
    bffRequest<MessageResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        nickname,
        agreed_terms: agreedTerms ?? true,
      }),
    }),

  /** 验证邮箱：校验验证码并完成登录 */
  verifyEmail: (email: string, code: string): Promise<AuthResponse> =>
    bffRequest<AuthResponse>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  /** 重新发送验证码 */
  resendCode: (email: string): Promise<MessageResponse> =>
    bffRequest<MessageResponse>("/api/auth/resend-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  /** 忘记密码：发送重置链接 */
  forgotPassword: (email: string): Promise<MessageResponse> =>
    bffRequest<MessageResponse>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  /** 重置密码 */
  resetPassword: (token: string, newPassword: string): Promise<MessageResponse> =>
    bffRequest<MessageResponse>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),

  /** 测试账号登录（开发调试） */
  devLogin: (): Promise<AuthResponse> =>
    bffRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
    }),

  /** 获取微信授权链接 */
  getWechatUrl: (redirect: string = "/projects"): Promise<{ url: string }> =>
    bffRequest<{ url: string }>(
      `/api/auth/wechat-url?redirect=${encodeURIComponent(redirect)}`
    ),

  /** 使用 httpOnly refresh token cookie 换发 access token */
  refresh: (): Promise<AuthResponse> =>
    bffRequest<AuthResponse>("/api/auth/refresh", {
      method: "POST",
    }),

  /** 退出登录：通知 BFF 清除 refresh token cookie */
  logout: (): Promise<void> =>
    bffRequest<void>("/api/auth/logout", {
      method: "POST",
    }),
};
