"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type {
  Report,
  SampleRepresentativeness,
  SampleSizePlannerRequest,
  SampleSizePlannerResult,
} from "@/types";

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
      format: "word" | "excel" | "pdf" | "ppt";
      dataSource: "real" | "simulated";
      includeAiConclusion?: boolean;
    }) =>
      apiClient.postBlob(
        `/api/report/${params.projectId}/export`,
        {
          format: params.format,
          data_source: params.dataSource,
          include_ai_conclusion: params.includeAiConclusion ?? false,
        }
      ),
  });
}

/**
 * 报告文字润色（R6）。
 * 调用 LLM 将指定章节的统计结果转化为论文段落。
 * 对应后端：POST /api/report/:reportId/polish
 */
export function usePolishReport() {
  return useMutation({
    mutationFn: (params: {
      reportId: string;
      section: "reliability" | "correlation" | "diff_test" | "diagnosis";
    }) =>
      apiClient.post<{
        section: string;
        text: string;
        disclaimer: string;
      }>(`/api/report/${params.reportId}/polish`, {
        section: params.section,
      }),
  });
}

/**
 * 样本代表性诊断（F-RPT-007，免费能力）。
 * 对应后端：GET /api/report/:projectId/sample-representativeness
 */
export function useSampleRepresentativeness(projectId: string) {
  return useQuery({
    queryKey: ["report", "sample-rep", projectId],
    queryFn: () =>
      apiClient.get<SampleRepresentativeness>(
        `/api/report/${projectId}/sample-representativeness`
      ),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 与后端 LLM 缓存对齐：5 分钟
  });
}

/**
 * 样本量规划（F-RPT-008，免费能力，确定性公式无 LLM）。
 * 对应后端：POST /api/report/:projectId/sample-size-planner
 */
export function useSampleSizePlanner(projectId: string) {
  return useMutation({
    mutationFn: (params: SampleSizePlannerRequest) =>
      apiClient.post<SampleSizePlannerResult>(
        `/api/report/${projectId}/sample-size-planner`,
        {
          analysis_type: params.analysisType,
          effect_size: params.effectSize ?? null,
          alpha: params.alpha ?? 0.05,
          power: params.power ?? 0.8,
          groups: params.groups ?? null,
          strata: params.strata ?? null,
          planned_n: params.plannedN ?? null,
        }
      ),
  });
}
