"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { questionnaireApi } from "@/lib/api/questionnaire";
import type { Question, QuestionnaireStructure } from "@/types";

const questionnaireKeys = {
  structure: (projectId: string) => ["questionnaire", projectId],
  dimensions: (projectId: string) => ["dimensions", projectId],
  health: (projectId: string) => ["questionnaire", "health", projectId],
};

/**
 * 题目体检 hooks。
 * 对应后端：POST /api/questionnaire/parse。
 */
export function useQuestionnaire(projectId: string) {
  return useQuery({
    queryKey: questionnaireKeys.structure(projectId),
    queryFn: () =>
      apiClient.get<{ structure: QuestionnaireStructure }>(
        `/api/questionnaire/${projectId}`
      ),
    enabled: !!projectId,
  });
}

/** 上传并解析题目 */
export function useParseQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; rawText: string }) =>
      apiClient.post<{ structure: QuestionnaireStructure }>(
        `/api/questionnaire/${params.projectId}/parse`,
        { rawText: params.rawText }
      ),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        questionnaireKeys.structure(variables.projectId),
        { structure: data.structure }
      );
    },
  });
}

/** 更新单题（维度/反向题/置信度） */
export function useUpdateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      projectId: string;
      questionIndex: number;
      dimension?: string;
      isReverse?: boolean;
      confidence?: "high" | "low";
    }) =>
      apiClient.patch<{ data: Question }>(
        `/api/questionnaire/${params.projectId}/questions/${params.questionIndex}`,
        {
          dimension: params.dimension,
          isReverse: params.isReverse,
          confidence: params.confidence,
        }
      ),
    onSuccess: (_data, variables) => {
      // 简单策略：invalidate 重新拉取最新结构（保证 dimensions 数组同步更新）
      queryClient.invalidateQueries({
        queryKey: questionnaireKeys.structure(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: questionnaireKeys.dimensions(variables.projectId),
      });
    },
  });
}

/** 获取维度列表 */
export function useDimensions(projectId: string) {
  return useQuery({
    queryKey: questionnaireKeys.dimensions(projectId),
    queryFn: () => questionnaireApi.getDimensions(projectId),
    enabled: !!projectId,
  });
}

/** 新增/重命名维度 */
export function useUpdateDimensions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      projectId: string;
      action: "add" | "rename";
      name: string;
      oldName?: string;
    }) => questionnaireApi.updateDimensions(params.projectId, params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: questionnaireKeys.dimensions(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: questionnaireKeys.structure(variables.projectId),
      });
    },
  });
}

/** 上传问卷文件并提取文本 */
export function useUploadQuestionnaire() {
  return useMutation({
    mutationFn: (params: { projectId: string; file: File }) =>
      questionnaireApi.upload(params.projectId, params.file),
  });
}

/** 导入问卷星导出文件（Excel/Word），自动解析题目、选项、维度 */
export function useWjxImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; file: File }) =>
      questionnaireApi.wjxImport(params.projectId, params.file),
    onSuccess: (_data, variables) => {
      // 问卷星导入成功后，刷新题目结构、维度列表与体检报告
      queryClient.invalidateQueries({
        queryKey: questionnaireKeys.structure(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: questionnaireKeys.dimensions(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: questionnaireKeys.health(variables.projectId),
      });
    },
  });
}

/**
 * 问卷质量体检（纯规则引擎）。
 * 对应后端：GET /api/questionnaire/{projectId}/health
 */
export function useQuestionnaireHealth(projectId: string) {
  return useQuery({
    queryKey: questionnaireKeys.health(projectId),
    queryFn: () =>
      apiClient.get<{
        total_questions: number;
        overall_score: number;
        grade: string;
        summary: string;
        items: Array<{
          key: string;
          title: string;
          status: "pass" | "warn" | "fail";
          score: number;
          message: string;
          suggestion: string;
        }>;
      }>(`/api/questionnaire/${projectId}/health`),
    enabled: !!projectId,
  });
}
