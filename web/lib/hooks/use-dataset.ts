"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { datasetApi, type DatasetInfo, type TemplateFormat, type MatchBy } from "@/lib/api/dataset";

const DATASET_QUERY_KEY = "dataset";

/** 查询项目最新数据集摘要 */
export function useDataset(projectId: string) {
  return useQuery({
    queryKey: [DATASET_QUERY_KEY, projectId],
    queryFn: () => datasetApi.getDataset(projectId),
    enabled: !!projectId,
  });
}

/** 下载真实数据导入模板 */
export function useDownloadTemplate() {
  return useMutation({
    mutationFn: async ({
      projectId,
      format,
      matchBy,
    }: {
      projectId: string;
      format?: TemplateFormat;
      matchBy?: MatchBy;
    }) => {
      const { blob, filename } = await datasetApi.downloadTemplate(projectId, {
        format,
        matchBy,
      });
      return { blob, filename };
    },
  });
}

/** 导入真实回收数据 */
export function useImportDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      file,
      matchBy,
    }: {
      projectId: string;
      file: File;
      matchBy?: MatchBy;
    }) => datasetApi.importDataset(projectId, { file, matchBy }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [DATASET_QUERY_KEY, variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project", variables.projectId],
      });
    },
  });
}

export type { DatasetInfo };
