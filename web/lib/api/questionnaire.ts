/**
 * 题目体检 API 客户端。
 * 对应后端：/api/questionnaire/*
 */

import { apiClient } from "./client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { QuestionnaireStructure } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export const questionnaireApi = {
  /** 获取项目题目结构 */
  get: (projectId: string) =>
    apiClient.get<{ structure: QuestionnaireStructure }>(
      `/api/questionnaire/${projectId}`
    ),

  /** 上传并解析题目 */
  parse: (projectId: string, rawText: string) =>
    apiClient.post<{ structure: QuestionnaireStructure }>(
      `/api/questionnaire/${projectId}/parse`,
      { rawText }
    ),

  /** 更新题目结构（用户手动调整） */
  update: (projectId: string, structure: QuestionnaireStructure) =>
    apiClient.put(`/api/questionnaire/${projectId}`, structure),

  /** 上传问卷文件并提取文本（multipart/form-data，不走通用 apiClient） */
  upload: async (projectId: string, file: File): Promise<{ text: string }> => {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const headers: Record<string, string> = {};
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const res = await fetch(
      `${API_BASE}/api/questionnaire/${projectId}/upload`,
      {
        method: "POST",
        headers,
        body: formData,
      }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message ?? `上传失败（${res.status}）`);
    }
    return json as { text: string };
  },
};
