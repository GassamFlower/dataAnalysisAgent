"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { questionnaireApi } from "@/lib/api/questionnaire";
import type { Question, QuestionnaireStructure } from "@/types";

const questionnaireKeys = {
  structure: (projectId: string) => ["questionnaire", projectId],
  dimensions: (projectId: string) => ["dimensions", projectId],
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
