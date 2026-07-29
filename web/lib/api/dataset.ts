/**
 * 数据集 API 客户端（真实回收数据导入）。
 * 对应后端：/api/dataset/*
 */

import { useAuthStore } from "@/lib/stores/auth-store";
import { apiClient } from "./client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type DatasetSource = "real" | "simulation";

export type TemplateFormat = "csv" | "xlsx";

export type MatchBy = "text" | "index";

export interface DatasetInfo {
  id: string;
  project_id: string;
  source: DatasetSource;
  sample_size: number;
  columns: string[];
  row_count: number;
  preview: Record<string, unknown>[];
  created_at: string;
}

export interface DatasetImportResult extends DatasetInfo {
  /** 与 DatasetInfo 字段一致，保留扩展空间 */
}

export interface DownloadTemplateOptions {
  format?: TemplateFormat;
  matchBy?: MatchBy;
}

export interface ImportDatasetOptions {
  file: File;
  matchBy?: MatchBy;
}

export const datasetApi = {
  /** 下载真实数据导入模板（CSV/XLSX） */
  downloadTemplate: async (
    projectId: string,
    options: DownloadTemplateOptions = {}
  ): Promise<{ blob: Blob; filename: string | null }> => {
    const { format = "xlsx", matchBy = "text" } = options;
    const headers: Record<string, string> = {};
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const url = new URL(
      `${API_BASE}/api/dataset/${projectId}/template`,
      typeof window === "undefined" ? "http://localhost" : window.location.origin
    );
    url.searchParams.set("format", format);
    url.searchParams.set("match_by", matchBy);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `下载模板失败（${res.status}）`);
    }

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    const filename = match ? match[1].replace(/['"]/g, "") : null;
    return { blob, filename };
  },

  /** 上传并导入真实回收数据（multipart/form-data） */
  importDataset: async (
    projectId: string,
    options: ImportDatasetOptions
  ): Promise<DatasetImportResult> => {
    const { file, matchBy = "text" } = options;
    const formData = new FormData();
    formData.append("file", file, file.name);

    const headers: Record<string, string> = {};
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const url = new URL(
      `${API_BASE}/api/dataset/${projectId}/import`,
      typeof window === "undefined" ? "http://localhost" : window.location.origin
    );
    url.searchParams.set("match_by", matchBy);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: formData,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || `导入失败（${res.status}）`);
    }
    return json.data as DatasetImportResult;
  },

  /** 获取项目最新数据集摘要 */
  getDataset: (projectId: string): Promise<DatasetInfo> =>
    apiClient.get<DatasetInfo>(`/api/dataset/${projectId}`),
};
