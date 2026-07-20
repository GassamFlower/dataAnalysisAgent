"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { paymentApi } from "@/lib/api/payment";
import type { CreateOrderRequest, OrderType, PaymentChannel, QuotaStatus } from "@/types/payment";

export { useSubscription } from "@/lib/hooks/use-subscription";

/** 当前周用量额度 */
export function useQuota() {
  return useQuery({
    queryKey: ["quota"],
    queryFn: () => paymentApi.getQuota(),
    staleTime: 30_000,
  });
}

/** 订单列表 */
export function useOrders(page = 1, pageSize = 10) {
  return useQuery({
    queryKey: ["orders", page, pageSize],
    queryFn: () => paymentApi.getOrders(page, pageSize),
  });
}

/** 创建订单 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderRequest) => paymentApi.createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

/** 模拟支付回调（开发验证用） */
export function useNotifyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      channel,
      transactionId,
      status,
    }: {
      orderId: string;
      channel: PaymentChannel;
      transactionId: string;
      status: "success" | "failed";
    }) => paymentApi.notifyPayment(orderId, { channel, transactionId, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

/**
 * 便捷 hook：创建订单并立即模拟支付成功。
 * Round 3.1 用于在没有真实微信支付时快速验证付费链路。
 */
export function usePurchasePlan() {
  const createOrder = useCreateOrder();
  const notifyPayment = useNotifyPayment();

  return {
    mutateAsync: async (planType: OrderType, projectId?: string) => {
      const order = await createOrder.mutateAsync({ planType, projectId });
      await notifyPayment.mutateAsync({
        orderId: order.id,
        channel: "wechat",
        transactionId: `mock-${Date.now()}`,
        status: "success",
      });
      return order;
    },
    isPending: createOrder.isPending || notifyPayment.isPending,
    error: createOrder.error || notifyPayment.error,
  };
}
