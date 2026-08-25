/**
 * 前端公开配置 API 客户端。
 * 对应后端：GET /api/v1/frontend/config（匿名可访问，仅返回非敏感配置）
 */
import { apiClient } from "./client";

export interface FrontendConfig {
  customer_service_wechat_id: string;
}

export const frontendConfigApi = {
  get: () => apiClient.get<FrontendConfig>("/api/v1/frontend/config"),
};