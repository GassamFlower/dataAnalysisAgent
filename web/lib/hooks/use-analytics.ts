import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { MetricsResponse } from "@/lib/types/analytics";

/**
 * 查询业务指标（管理员专用）
 */
export function useMetrics(days: number = 7) {
  return useQuery<MetricsResponse>({
    queryKey: ["metrics", days],
    queryFn: () => apiClient.get<MetricsResponse>(`/analytics/metrics?days=${days}`),
    staleTime: 60 * 1000, // 1 分钟缓存
  });
}
