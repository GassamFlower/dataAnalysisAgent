/**
 * 项目管理 API 客户端。
 * 对应后端：/api/projects/*
 */

import { apiClient } from "./client";
import type { Project } from "@/types";

export interface ProjectListParams {
  page?: number;
  pageSize?: number;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  pageSize: number;
}

export const projectsApi = {
  /** 获取项目列表（支持分页） */
  list: (params: ProjectListParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.pageSize) searchParams.set("page_size", String(params.pageSize));
    const query = searchParams.toString();
    return apiClient.get<ProjectListResponse>(
      `/api/projects${query ? `?${query}` : ""}`
    );
  },

  /** 获取单个项目 */
  get: (projectId: string) =>
    apiClient.get<Project>(`/api/projects/${projectId}`),

  /** 创建项目 */
  create: (data: { name: string }) =>
    apiClient.post<Project>("/api/projects", data),

  /** 更新项目（当前仅支持重命名） */
  update: (projectId: string, data: { name: string }) =>
    apiClient.patch<Project>(`/api/projects/${projectId}`, data),

  /** 删除项目 */
  delete: (projectId: string) =>
    apiClient.delete(`/api/projects/${projectId}`),
};
