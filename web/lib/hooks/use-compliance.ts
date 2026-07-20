"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { complianceApi } from "@/lib/api/compliance";

/** 检查用户是否已同意模拟数据承诺 */
export function useSimulationDisclaimerCheck() {
  return useQuery({
    queryKey: ["compliance", "simulation-disclaimer"],
    queryFn: () => complianceApi.checkSimulationDisclaimer(),
    staleTime: 5 * 60 * 1000,
  });
}

/** 记录用户同意模拟数据承诺 */
export function useConfirmSimulationDisclaimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => complianceApi.confirmSimulationDisclaimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["compliance", "simulation-disclaimer"],
      });
    },
  });
}

/** 获取用户所有协议同意状态 */
export function useAgreementsStatus() {
  return useQuery({
    queryKey: ["compliance", "agreements-status"],
    queryFn: () => complianceApi.getAgreementsStatus(),
    staleTime: 5 * 60 * 1000,
  });
}
