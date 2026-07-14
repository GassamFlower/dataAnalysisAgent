/**
 * BFF 层认证工具：从 incoming request 提取 Authorization 头，转发给后端。
 */

/** 从请求头中提取 Authorization 值 */
export function getAuthHeader(request: Request): string | null {
  return request.headers.get("Authorization");
}

/** 构建转发给后端的 headers（保留用户 token） */
export function getBackendHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const auth = getAuthHeader(request);
  if (auth) {
    headers["Authorization"] = auth;
  }
  return headers;
}
