/**
 * 支付/订阅 API 客户端。
 * 对应 BFF：/api/payment/*
 */

import { useAuthStore } from "@/lib/stores/auth-store";
import type {
  CreateOrderRequest,
  Order,
  OrderListResponse,
  OrderType,
  PaymentChannel,
  QuotaStatus,
  Subscription,
} from "@/types/payment";

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  details?: Record<string, unknown>;
}

export class PaymentApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PaymentApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(path, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

  const json = (await res.json().catch(() => ({
    code: 50000,
    message: "服务器返回格式异常",
  }))) as ApiResponse<T>;

  if (!res.ok || json.code !== 0) {
    throw new PaymentApiError(
      json.code ?? res.status * 100,
      json.message ?? res.statusText,
      json.details
    );
  }

  return json.data;
}

export const paymentApi = {
  /** 获取当前用户套餐状态 */
  getSubscription: (): Promise<Subscription> =>
    request<Subscription>("/api/payment/subscription"),

  /** 获取订单列表 */
  getOrders: (page = 1, pageSize = 10): Promise<OrderListResponse> =>
    request<OrderListResponse>(
      `/api/payment/orders?page=${page}&page_size=${pageSize}`
    ),

  /** 创建订单 */
  createOrder: (data: CreateOrderRequest): Promise<Order> =>
    request<Order>("/api/payment/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** 模拟支付回调（开发验证） */
  notifyPayment: (
    orderId: string,
    data: { channel: PaymentChannel; transactionId: string; status: "success" | "failed" }
  ): Promise<{ success: boolean; message: string }> =>
    request<{ success: boolean; message: string }>(
      `/api/payment/orders/${orderId}/notify`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

  /** 获取当前用户本周用量额度 */
  getQuota: (): Promise<QuotaStatus> =>
    request<QuotaStatus>("/api/payment/quota"),
};
