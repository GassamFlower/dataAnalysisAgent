/**
 * 报告 API 客户端。
 * 对应后端：/api/report/*
 */

import { apiClient } from "./client";
import type { Report } from "@/types";

export const reportApi = {
  /** 获取报告 */
  get: (projectId: string) =>
    apiClient.get<Report>(`/api/report/${projectId}`),

  /** 导出报告（返回二进制 Blob + 文件名） */
  export: (projectId: string, format: "word" | "excel") =>
    apiClient.postBlob(`/api/report/${projectId}/export`, { format }),
};
