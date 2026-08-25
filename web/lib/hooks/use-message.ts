"use client";

import { useMutation } from "@tanstack/react-query";

import { messageApi } from "@/lib/api/message";
import type { ContactSubmitPayload, MessageData } from "@/types/message";

/** 提交留言 */
export function useSubmitMessage() {
  return useMutation<MessageData, Error, ContactSubmitPayload>({
    mutationFn: (payload) => messageApi.create(payload),
  });
}