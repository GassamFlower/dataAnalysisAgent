"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type {
  SimulationData,
  CorrelationMatrix,
  HypothesisPath,
} from "@/types";

const simulationKeys = {
  simulation: (projectId: string) => ["simulation", projectId],
};

/**
 * 数据生成 hooks。
 * 对应后端：GET /api/simulation/{id}（矩阵 + 已保存假设）。
 */
export function useSimulation(projectId: string) {
  return useQuery({
    queryKey: simulationKeys.simulation(projectId),
    queryFn: () =>
      apiClient.get<SimulationData>(`/api/simulation/${projectId}`),
    enabled: !!projectId,
  });
}

/** 解析研究假设（LLM） */
export function useParseHypothesis() {
  return useMutation({
    mutationFn: (params: { projectId: string; rawText: string }) =>
      apiClient.post<{
        id: string;
        projectId: string;
        rawText: string;
        paths: HypothesisPath[];
      }>(`/api/simulation/${params.projectId}/hypothesis`, {
        raw_text: params.rawText,
      }),
  });
}

/** 生成模拟数据 */
export function useGenerateSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; sampleSize: number }) =>
      apiClient.post<{ matrix: SimulationData["matrix"] }>(
        `/api/simulation/${params.projectId}/generate`,
        { sample_size: params.sampleSize }
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: simulationKeys.simulation(variables.projectId),
      });
    },
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
    onSuccess: (_data, variables) => {
      // 保存成功后刷新 simulation 缓存（确保下次 GET 返回最新数据）
      queryClient.invalidateQueries({
        queryKey: simulationKeys.simulation(variables.projectId),
      });
    },
  });
}

/** 导出模拟数据集（Excel / CSV） */
export function useExportDataset() {
  return useMutation({
    mutationFn: (params: { projectId: string; format: "excel" | "csv" }) =>
      apiClient.postBlob(`/api/simulation/${params.projectId}/export-data`, {
        format: params.format,
      }),
  });
}
