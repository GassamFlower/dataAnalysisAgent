"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { paymentApi } from "@/lib/api/payment";
import type { OrderType } from "@/types/payment";

/**
 * 微信 Native 扫码支付流程 hook：
 * 1. createOrder 创建本地订单
 * 2. createWxPayQr 向微信统一下单，拿到 code_url（二维码内容）
 * 3. 前端轮询订单状态直到 paid（或手动关闭）
 *
 * 使用场景：/pricing 页点击「购买/订阅」后弹出二维码。
 */
export function useWechatPayQr() {
  const queryClient = useQueryClient();
  const [qrState, setQrState] = useState<{
    open: boolean;
    codeUrl: string;
    orderId: string;
  }>({ open: false, codeUrl: "", orderId: "" });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const createOrder = useMutation({
    mutationFn: (planType: OrderType) => paymentApi.createOrder({ planType }),
  });
  const createQr = useMutation({
    mutationFn: (orderId: string) => paymentApi.createWxPayQr(orderId),
  });

  // 关闭二维码
  const closeQr = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setQrState({ open: false, codeUrl: "", orderId: "" });
  }, []);

  // 轮询订单状态
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
      // 立即查一次，再 2 秒一轮
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
        const { code_url } = await createQr.mutateAsync(order.id);
        setQrState({ open: true, codeUrl: code_url, orderId: order.id });
        pollStatus(order.id);
      } catch (err) {
        // 微信支付未配置/下单失败 → 抛给调用方，可回落到手动/提示
        closeQr();
        throw err;
      }
    },
    [createOrder, createQr, pollStatus, closeQr]
  );

  useEffect(() => () => {
    // 组件卸载清理轮询
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