/**
 * 留言 API 客户端。
 * 对应后端：/api/v1/messages（BFF 兜底转发链路，见 app/api/v1/[...path]/route.ts）
 */
import { apiClient } from "./client";
import type {
  MessageTag,
  MessageData,
  ContactSubmitPayload,
} from "@/types/message";

export const messageApi = {
  /** 提交留言 */
  create: (payload: ContactSubmitPayload) =>
    apiClient.post<MessageData>("/api/v1/messages", payload),
};