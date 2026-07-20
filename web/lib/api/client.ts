/**
 * API 客户端基础封装。
 * - 统一响应格式：{ code, message, data }
 * - 错误码统一处理：401 跳转、403 引导付费、422 表单错误等
 * - Token 自动续期：短 token + refresh token 机制
 * - 超时与重试：GET 超时 10s 重试 1 次，副作用操作不重试
 *
 * 业务域接口请分文件写在 lib/api/ 下，禁止在组件内直接 fetch。
 */

import { useAuthStore } from "@/lib/stores/auth-store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

/** 后端统一响应结构 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  details?: Record<string, unknown>;
}

/** 自定义 API 错误 */
export class ApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 网络/超时错误 */
export class NetworkError extends Error {
  constructor(message = "网络请求失败") {
    super(message);
    this.name = "NetworkError";
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | boolean>;
  body?: unknown;
  /** 超时时间（毫秒），默认按方法区分 */
  timeout?: number;
  /** 是否禁用重试 */
  noRetry?: boolean;
}

interface RefreshState {
  promise: Promise<string | null> | null;
}

const refreshState: RefreshState = { promise: null };

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const accessToken = useAuthStore.getState().accessToken;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshState.promise) return refreshState.promise;

  refreshState.promise = (async () => {
    try {
      // refresh 必须走同域 BFF，才能携带 httpOnly refresh-token cookie
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const json = (await res.json()) as ApiResponse<{ accessToken: string }>;
      if (json.code !== 0) return null;
      useAuthStore.getState().setAccessToken(json.data.accessToken);
      return json.data.accessToken;
    } catch {
      return null;
    } finally {
      refreshState.promise = null;
    }
  })();

  return refreshState.promise;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const url = new URL(
    `${API_BASE}${path}`,
    typeof window === "undefined" ? "http://localhost" : window.location.origin
  );
  if (params) {
    Object.entries(params).forEach(([k, v]) =>
      url.searchParams.set(k, String(v))
    );
  }
  return url.toString();
}

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeout: number
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new NetworkError(`请求超时（${timeout}ms）`));
    }, timeout);

    fetch(url, { ...init, signal: controller.signal })
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        if (err instanceof NetworkError) {
          reject(err);
        } else if (err.name === "AbortError") {
          reject(new NetworkError("请求被取消"));
        } else {
          reject(new NetworkError(err?.message ?? "网络请求失败"));
        }
      });
  });
}

function getDefaultTimeout(method: string): number {
  switch (method) {
    case "GET":
      return 10_000;
    case "POST":
    case "PUT":
    case "PATCH":
      return 60_000;
    case "DELETE":
      return 10_000;
    default:
      return 10_000;
  }
}

function shouldRetry(method: string, status: number, noRetry?: boolean): boolean {
  if (noRetry) return false;
  if (method !== "GET") return false;
  if (status >= 500 || status === 0) return true;
  return false;
}

function handleAuthError(code: number): void {
  if (typeof window === "undefined") return;
  if (code === 40100) {
    useAuthStore.getState().logout();
    window.location.href = "/login";
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  attempt = 0
): Promise<T> {
  const {
    params,
    body,
    headers,
    timeout = getDefaultTimeout(options.method ?? "GET"),
    noRetry,
    ...init
  } = options;

  const url = buildUrl(path, params);
  const method = init.method ?? "GET";

  const res = await fetchWithTimeout(
    url,
    {
      ...init,
      method,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    timeout
  ).catch(async (err) => {
    if (shouldRetry(method, 0, noRetry) && attempt < 1) {
      await new Promise((r) => setTimeout(r, 1000));
      return request<T>(path, options, attempt + 1);
    }
    throw err;
  });

  if (typeof res === "undefined" || !(res instanceof Response)) {
    return res as Promise<T>;
  }

  // 401 时尝试刷新 access token 并重试一次
  if (res.status === 401 && typeof window !== "undefined") {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      return request<T>(path, options, attempt + 1);
    }
    useAuthStore.getState().logout();
    window.location.href = "/login";
    throw new ApiError(40100, "登录已过期，请重新登录");
  }

  const json = (await res.json().catch(() => ({
    code: 50000,
    message: "服务器返回格式异常",
  }))) as ApiResponse<T>;

  if (!res.ok || json.code !== 0) {
    const code = json.code ?? res.status * 100;
    handleAuthError(code);

    if (shouldRetry(method, res.status, noRetry) && attempt < 1) {
      await new Promise((r) => setTimeout(r, 1000));
      return request<T>(path, options, attempt + 1);
    }

    throw new ApiError(code, json.message ?? res.statusText, json.details);
  }

  return json.data as T;
}

async function postBlob(
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<{ blob: Blob; filename: string | null }> {
  const { params, headers, timeout = 120_000, ...init } = options;
  const url = buildUrl(path, params);

  const res = await fetchWithTimeout(
    url,
    {
      ...init,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    timeout
  );

  if (res.status === 401 && typeof window !== "undefined") {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      return postBlob(path, body, options);
    }
    useAuthStore.getState().logout();
    window.location.href = "/login";
    throw new ApiError(40100, "登录已过期，请重新登录");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status * 100, text || res.statusText);
  }

  const blob = await res.blob();
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
