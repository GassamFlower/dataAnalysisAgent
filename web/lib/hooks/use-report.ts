"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { Report } from "@/types";

/**
 * 报告 hooks。
 * 对应后端：GET /api/report/:projectId、POST /api/report/:projectId/analyze、POST /api/report/:projectId/export。
 */
export function useReport(projectId: string) {
  return useQuery({
    queryKey: ["report", projectId],
    queryFn: () => apiClient.get<Report>(`/api/report/${projectId}`),
    enabled: !!projectId,
    retry: false, // 404 时不自动重试，由页面决定是否触发 analyze
  });
}

/** 生成报告（调用后端 analyze 跑统计套餐 + 诊断） */
export function useAnalyzeReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiClient.post<Report>(`/api/report/${projectId}/analyze`),
    onSuccess: () => {
      // analyze 成功后刷新报告缓存
      queryClient.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

/** 导出报告（返回二进制 Blob，由调用方触发浏览器下载） */
export function useExportReport() {
  return useMutation({
    mutationFn: (params: {
      projectId: string;
      format: "word" | "excel";
    }) =>
      apiClient.postBlob(
        `/api/report/${params.projectId}/export`,
        { format: params.format }
      ),
  });
}
