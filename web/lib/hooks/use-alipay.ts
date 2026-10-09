"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { paymentApi } from "@/lib/api/payment";
import type { OrderType } from "@/types/payment";

/**
 * 支付宝扫码支付流程 hook：
 * 1. createOrder 创建本地订单
 * 2. createAlipayQr 向支付宝预下单，拿到 qr_code（二维码内容）
 * 3. 前端轮询订单状态直到 paid（或手动关闭）
 */
export function useAlipayQr() {
  const queryClient = useQueryClient();
  const [qrState, setQrState] = useState<{
    open: boolean;
    qrCode: string;
    orderId: string;
  }>({ open: false, qrCode: "", orderId: "" });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const createOrder = useMutation({
    mutationFn: (planType: OrderType) => paymentApi.createOrder({ planType }),
  });
  const createQr = useMutation({
    mutationFn: (orderId: string) => paymentApi.createAlipayQr(orderId),
  });

  const closeQr = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setQrState({ open: false, qrCode: "", orderId: "" });
  }, []);

  const pollStatus = useCallback(
    (orderId: string) => {
      const tick = async () => {
        try {
          const order = await paymentApi.queryOrder(orderId);
          if (order.status === "paid") {
            queryClient.invalidateQueries({ queryKey: ["subscription"] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            closeQr();
            return "paid";
          }
        } catch {
          /* 忽略临时性错误，继续轮询 */
        }
        return "pending";
      };
      void tick();
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(() => void tick(), 2000);
    },
    [closeQr, queryClient]
  );

  const startPay = useCallback(
    async (planType: OrderType) => {
      const order = await createOrder.mutateAsync(planType);
      try {
        const { qr_code } = await createQr.mutateAsync(order.id);
        setQrState({ open: true, qrCode: qr_code, orderId: order.id });
        pollStatus(order.id);
      } catch (err) {
        closeQr();
        throw err;
      }
    },
    [createOrder, createQr, pollStatus, closeQr]
  );

  useEffect(() => () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
  }, []);

  return {
    qrState,
    startPay,
    closeQr,
    isPending: createOrder.isPending || createQr.isPending,
    error: createOrder.error || createQr.error,
  };
}
