import { apiClient } from "./client";

export interface HealthData {
  status: string;
  service: string;
  timestamp: string;
}

/**
 * 健康检查示例接口。
 * 用于验证 apiClient 的统一响应处理。
 */
export function getHealth() {
  return apiClient.get<HealthData>("/health");
}
