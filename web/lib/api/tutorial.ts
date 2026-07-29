/**
 * 教程模块 API 客户端。
 *
 * 处理引导进度、指标解读、新手引导等教程相关操作。
 */

import { apiClient } from "./client";

/** 用户引导进度响应 */
export interface TutorialProgressResponse {
  current_step: number;
  total_steps: number;
  completed: boolean;
  completed_at: string | null;
  step_details: Record<string, boolean> | null;
}

/** 更新引导进度请求 */
export interface TutorialProgressUpdateRequest {
  step: number;
  completed: boolean;
}

/** 更新引导进度响应 */
export interface TutorialProgressUpdateResponse {
  success: boolean;
  current_step: number;
  total_steps: number;
  all_completed: boolean;
}

/** 指标解读响应 */
export interface MetricTooltipResponse {
  metric_type: string;
  title: string;
  content: string;
  example: string;
}

/** 引导步骤 */
export interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  target: string;
}

/** 启动引导响应 */
export interface OnboardingStartResponse {
  tour_id: string;
  steps: OnboardingStep[];
}

/** 启动引导请求 */
export interface OnboardingStartRequest {
  project_id: string;
}

/** 教程文章 */
export interface TutorialArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  content_markdown: string;
  summary: string | null;
  cover_image: string | null;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at?: string;
}

/** 教程列表项 */
export interface TutorialArticleListItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  content_markdown: string;
  summary: string | null;
  cover_image: string | null;
  order_index: number;
  is_published: boolean;
  created_at: string;
}

/** 教程列表响应 */
export interface TutorialArticleListResponse {
  items: TutorialArticleListItem[];
  total: number;
  page: number;
  page_size: number;
}

/** 教程列表查询参数 */
export interface TutorialArticleQueryParams {
  category?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}

/** 创建/更新教程请求 */
export interface TutorialArticleCreateRequest {
  slug: string;
  title: string;
  category: string;
  content_markdown: string;
  summary?: string;
  cover_image?: string;
  order_index?: number;
  is_published?: boolean;
}

export type TutorialArticleUpdateRequest = Partial<TutorialArticleCreateRequest>;

/** AI 解读请求 */
export interface AIInterpretRequest {
  question?: string;
  section?: "reliability" | "correlation" | "diff_test" | "overall";
}

/** AI 解读响应 */
export interface AIInterpretResponse {
  project_id: string;
  content: string;
  section: string;
  question: string | null;
  quota_remaining: number;
}

/** AI 解读额度状态 */
export interface AIInterpretQuota {
  used: number;
  limit: number;
  remaining: number;
}

export const tutorialApi = {
  /** 获取用户引导进度 */
  getProgress: (): Promise<TutorialProgressResponse> =>
    apiClient.get<TutorialProgressResponse>("/api/v1/tutorial/progress"),

  /** 更新用户引导进度 */
  updateProgress: (
    data: TutorialProgressUpdateRequest
  ): Promise<TutorialProgressUpdateResponse> =>
    apiClient.post<TutorialProgressUpdateResponse>("/api/v1/tutorial/progress", data),

  /** 重置用户引导进度 */
  resetProgress: (): Promise<{ success: boolean }> =>
    apiClient.post<{ success: boolean }>("/api/v1/tutorial/progress/reset"),

  /** 获取指标解读内容 */
  getMetricTooltip: (metricType: string): Promise<MetricTooltipResponse> =>
    apiClient.get<MetricTooltipResponse>(`/api/v1/tutorial/metric-tooltip/${metricType}`),

  /** 获取所有指标类型 */
  getMetricTypes: (): Promise<string[]> =>
    apiClient.get<string[]>("/api/v1/tutorial/metric-types"),

  /** 启动新手引导 */
  startOnboarding: (
    data: OnboardingStartRequest
  ): Promise<OnboardingStartResponse> =>
    apiClient.post<OnboardingStartResponse>("/api/v1/tutorial/onboarding/start", data),

  /** 获取教程列表 */
  getArticles: (
    params?: TutorialArticleQueryParams
  ): Promise<TutorialArticleListResponse> => {
    const filteredParams: Record<string, string | number | boolean> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          filteredParams[key] = value;
        }
      });
    }
    return apiClient.get<TutorialArticleListResponse>("/api/v1/tutorial/articles", {
      params: filteredParams,
    });
  },

  /** 获取教程详情 */
  getArticle: (slug: string): Promise<TutorialArticle> =>
    apiClient.get<TutorialArticle>(`/api/v1/tutorial/articles/${slug}`),

  /** 创建教程（管理员） */
  createArticle: (
    data: TutorialArticleCreateRequest
  ): Promise<TutorialArticle> =>
    apiClient.post<TutorialArticle>("/api/v1/tutorial/admin/articles", data),

  /** 更新教程（管理员） */
  updateArticle: (
    id: string,
    data: TutorialArticleUpdateRequest
  ): Promise<TutorialArticle> =>
    apiClient.put<TutorialArticle>(`/api/v1/tutorial/admin/articles/${id}`, data),

  /** 删除教程（管理员） */
  deleteArticle: (id: string): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>(`/api/v1/tutorial/admin/articles/${id}`),

  /** 查询 AI 解读剩余额度 */
  getAIInterpretQuota: (): Promise<AIInterpretQuota> =>
    apiClient.get<AIInterpretQuota>("/api/v1/tutorial/ai-interpret/quota"),

  /** 生成 AI 解读 */
  aiInterpret: (
    projectId: string,
    data: AIInterpretRequest
  ): Promise<AIInterpretResponse> =>
    apiClient.post<AIInterpretResponse>(
      `/api/v1/tutorial/ai-interpret/${projectId}`,
      data
    ),
};
