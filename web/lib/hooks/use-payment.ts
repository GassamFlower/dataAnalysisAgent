"use client";

import { useQuery } from "@tanstack/react-query";

import { paymentApi } from "@/lib/api/payment";

/** 当前周用量额度（enabled=false 时不请求，供公开页面按登录状态启用） */
export function useQuota(enabled = true) {
  return useQuery({
    queryKey: ["quota"],
    queryFn: () => paymentApi.getQuota(),
    staleTime: 30_000,
    enabled,
  });
}
