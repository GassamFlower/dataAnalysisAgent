"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tutorialApi,
  type MetricTooltipResponse,
  type OnboardingStartRequest,
  type OnboardingStep,
  type TutorialProgressUpdateRequest,
  type TutorialArticleQueryParams,
  type TutorialArticle,
  type TutorialArticleCreateRequest,
  type TutorialArticleUpdateRequest,
  type AIInterpretRequest,
  type AIInterpretResponse,
  type AIInterpretQuota,
} from "@/lib/api/tutorial";

export type { OnboardingStep };

const TUTORIAL_QUERY_KEY = ["tutorial"];
const PROGRESS_QUERY_KEY = [...TUTORIAL_QUERY_KEY, "progress"];

/** 获取用户引导进度 */
export function useTutorialProgress() {
  return useQuery({
    queryKey: PROGRESS_QUERY_KEY,
    queryFn: () => tutorialApi.getProgress(),
    staleTime: 5 * 60 * 1000,
  });
}

/** 更新用户引导进度 */
export function useUpdateTutorialProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TutorialProgressUpdateRequest) =>
      tutorialApi.updateProgress(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY });
    },
  });
}

/** 重置用户引导进度 */
export function useResetTutorialProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => tutorialApi.resetProgress(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY });
    },
  });
}

/** 启动新手引导 */
export function useStartOnboarding() {
  return useMutation({
    mutationFn: (data: OnboardingStartRequest) =>
      tutorialApi.startOnboarding(data),
  });
}

/** 获取指标解读内容 */
export function useMetricTooltip(metricType: string) {
  return useQuery<MetricTooltipResponse>({
    queryKey: [...TUTORIAL_QUERY_KEY, "metric-tooltip", metricType],
    queryFn: () => tutorialApi.getMetricTooltip(metricType),
    enabled: !!metricType,
    staleTime: 60 * 60 * 1000, // 指标解读内容静态，缓存 1 小时
  });
}

/** 获取所有指标类型 */
export function useMetricTypes() {
  return useQuery({
    queryKey: [...TUTORIAL_QUERY_KEY, "metric-types"],
    queryFn: () => tutorialApi.getMetricTypes(),
    staleTime: 60 * 60 * 1000,
  });
}

const ARTICLES_QUERY_KEY = [...TUTORIAL_QUERY_KEY, "articles"];

/** 获取教程列表 */
export function useTutorialArticles(params?: TutorialArticleQueryParams) {
  return useQuery({
    queryKey: [...ARTICLES_QUERY_KEY, params],
    queryFn: () => tutorialApi.getArticles(params),
    staleTime: 5 * 60 * 1000,
  });
}

/** 获取教程详情 */
export function useTutorialArticle(slug: string) {
  return useQuery<TutorialArticle>({
    queryKey: [...TUTORIAL_QUERY_KEY, "article", slug],
    queryFn: () => tutorialApi.getArticle(slug),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });
}

/** 创建教程（管理员） */
export function useCreateTutorialArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TutorialArticleCreateRequest) =>
      tutorialApi.createArticle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARTICLES_QUERY_KEY });
    },
  });
}

/** 更新教程（管理员） */
export function useUpdateTutorialArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: TutorialArticleUpdateRequest;
    }) => tutorialApi.updateArticle(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ARTICLES_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: [...TUTORIAL_QUERY_KEY, "article"],
      });
    },
  });
}

/** 删除教程（管理员） */
export function useDeleteTutorialArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tutorialApi.deleteArticle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARTICLES_QUERY_KEY });
    },
  });
}

// ========== AI 解读助手 ==========

const AI_INTERPRET_QUOTA_KEY = [...TUTORIAL_QUERY_KEY, "ai-interpret-quota"];

/** 查询 AI 解读剩余额度 */
export function useAIInterpretQuota() {
  return useQuery<AIInterpretQuota>({
    queryKey: AI_INTERPRET_QUOTA_KEY,
    queryFn: () => tutorialApi.getAIInterpretQuota(),
    staleTime: 30 * 1000,
  });
}

/** 生成 AI 解读 */
export function useAIInterpret(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<AIInterpretResponse, Error, AIInterpretRequest>({
    mutationFn: (data) => tutorialApi.aiInterpret(projectId, data),
    onSuccess: () => {
      // 扣减后刷新额度
      queryClient.invalidateQueries({ queryKey: AI_INTERPRET_QUOTA_KEY });
    },
  });
}
