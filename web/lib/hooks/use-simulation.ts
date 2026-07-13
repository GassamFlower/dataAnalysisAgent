"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { SimulationData, SimulationConfig, CorrelationMatrix } from "@/types";

/**
 * 数据生成 hooks。
 * 对应后端：GET /api/simulation/{id}（矩阵 + 已保存假设）。
 */
export function useSimulation(projectId: string) {
  return useQuery({
    queryKey: ["simulation", projectId],
    queryFn: () =>
      apiClient.get<SimulationData>(`/api/simulation/${projectId}`),
    enabled: !!projectId,
  });
}

/** 生成模拟数据 */
export function useGenerateSimulation() {
  return useMutation({
    mutationFn: (params: { projectId: string; config: SimulationConfig }) =>
      apiClient.post<{ matrix: SimulationData["matrix"] }>(
        `/api/simulation/${params.projectId}/generate`,
        params.config
      ),
  });
}

/** 保存矩阵（持久化用户编辑） */
export function useSaveMatrix() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      projectId: string;
      matrix: CorrelationMatrix;
    }) =>
      apiClient.put<{ matrixId: string; projectId: string }>(
        `/api/simulation/${params.projectId}/matrix`,
        params.matrix
      ),
    onSuccess: () => {
      // 保存成功后刷新 simulation 缓存（确保下次 GET 返回最新数据）
      queryClient.invalidateQueries({ queryKey: ["simulation"] });
    },
  });
}

/** 导出模拟数据集（Excel） */
export function useExportDataset() {
  return useMutation({
    mutationFn: (projectId: string) =>
      apiClient.postBlob(`/api/simulation/${projectId}/export-data`),
  });
}
