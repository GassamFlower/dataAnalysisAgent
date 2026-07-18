"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { projectsApi, type ProjectListParams } from "@/lib/api/projects";
import type { Project } from "@/types";

const DEFAULT_PAGE_SIZE = 8;

/** 项目列表（分页） */
export function useProjects(params: ProjectListParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  return useQuery({
    queryKey: ["projects", page, pageSize],
    queryFn: () => projectsApi.list({ page, pageSize }),
  });
}

/** 单个项目 */
export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiClient.get<Project>(`/api/projects/${projectId}`),
    enabled: !!projectId,
  });
}

/** 创建项目 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { name: string }) =>
      apiClient.post<Project>("/api/projects", { name: params.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** 更新项目（当前仅支持重命名） */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      name,
    }: {
      projectId: string;
      name: string;
    }) => projectsApi.update(projectId, { name }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({
        queryKey: ["project", variables.projectId],
      });
    },
  });
}

/** 删除项目 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) =>
      apiClient.delete<{ success: boolean; id: string }>(
        `/api/projects/${projectId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
