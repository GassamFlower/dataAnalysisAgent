/**
 * 项目管理 API 客户端。
 * 对应后端：/api/projects/*
 */

import { apiClient } from "./client";
import type { Project } from "@/types";

export const projectsApi = {
  /** 获取项目列表 */
  list: () => apiClient.get<{ projects: Project[] }>("/api/projects"),

  /** 获取单个项目 */
  get: (projectId: string) =>
    apiClient.get<Project>(`/api/projects/${projectId}`),

  /** 创建项目 */
  create: (data: { name: string }) =>
    apiClient.post<Project>("/api/projects", data),

  /** 删除项目 */
  delete: (projectId: string) =>
    apiClient.delete(`/api/projects/${projectId}`),
};
