/**
 * API 客户端。封装 fetch，对接后端 BFF（Next.js API Routes）。
 * 业务域分文件：questionnaire / simulation / report。
 */

import { useAuthStore } from "@/lib/stores/auth-store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

interface RequestOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | boolean>;
  body?: unknown;
}

/** 获取当前用户的 Authorization 头 */
function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, body, headers, ...init } = options;

  const url = new URL(`${API_BASE}${path}`, typeof window === "undefined" ? "http://localhost" : window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/** 发送 JSON body，返回二进制 Blob（用于文件下载场景） */
async function postBlob(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<{ blob: Blob; filename: string | null }> {
  const { params, headers, ...init } = options ?? {};

  const url = new URL(`${API_BASE}${path}`, typeof window === "undefined" ? "http://localhost" : window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }

  const res = await fetch(url.toString(), {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  const blob = await res.blob();
  // 从 Content-Disposition 解析文件名
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  const filename = match ? match[1].replace(/['"]/g, "") : null;
  return { blob, filename };
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
  /** POST JSON，返回二进制 Blob + 文件名（下载场景） */
  postBlob: (path: string, body?: unknown, options?: RequestOptions) =>
    postBlob(path, body, options),
};
