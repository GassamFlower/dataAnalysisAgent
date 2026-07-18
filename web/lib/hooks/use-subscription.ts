"use client";

import { useQuery } from "@tanstack/react-query";

import { paymentApi } from "@/lib/api/payment";

/** 当前用户套餐状态 */
export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () => paymentApi.getSubscription(),
    staleTime: 60_000,
  });
}
