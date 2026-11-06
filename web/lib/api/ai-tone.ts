/**
 * 文字体检 API 客户端。
 * 对应后端：POST /api/v1/ai-tone/analyze、POST /api/v1/ai-tone/rewrite。
 */
import { apiClient } from "@/lib/api/client";
import type { AiToneAnalysis, AiToneRewriteResult } from "@/types/ai-tone";

export const aiToneApi = {
  analyze: (text: string) =>
    apiClient.post<AiToneAnalysis>("/api/v1/ai-tone/analyze", { text }),

  rewrite: (text: string) =>
    apiClient.post<AiToneRewriteResult>(
      "/api/v1/ai-tone/rewrite",
      { text },
      { timeout: 120_000 }
    ),
};
