/**
 * 数据生成 API 客户端。
 * 对应后端：/api/simulation/*
 */

import { apiClient } from "./client";
import type { CorrelationMatrix, SimulationConfig } from "@/types";

export const simulationApi = {
  /** 获取已生成的矩阵 */
  get: (projectId: string) =>
    apiClient.get<{ matrix: CorrelationMatrix }>(
      `/api/simulation/${projectId}`
    ),

  /** 生成模拟数据 */
  generate: (projectId: string, config: SimulationConfig) =>
    apiClient.post<{ matrix: CorrelationMatrix }>(
      `/api/simulation/${projectId}/generate`,
      config
    ),

  /** 更新矩阵（用户手动调整） */
  updateMatrix: (projectId: string, matrix: CorrelationMatrix) =>
    apiClient.put(`/api/simulation/${projectId}/matrix`, { matrix }),
};
