/**
 * 题目体检 API 客户端。
 * 对应后端：/api/questionnaire/*
 */

import { apiClient } from "./client";
import type { QuestionnaireStructure } from "@/types";

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
};
