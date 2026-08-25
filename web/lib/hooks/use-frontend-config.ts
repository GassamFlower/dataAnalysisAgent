"use client";

import { useQuery } from "@tanstack/react-query";

import { frontendConfigApi } from "@/lib/api/frontend-config";
import type { FrontendConfig } from "@/lib/api/frontend-config";

/** 读取前端公开配置（含客服微信号占位）。匿名可访问，失败静默降级为空配置。 */
export function useFrontendConfig() {
  return useQuery<FrontendConfig, Error>({
    queryKey: ["frontend-config"],
    queryFn: frontendConfigApi.get,
    staleTime: 60_000,
    retry: 1,
  });
}