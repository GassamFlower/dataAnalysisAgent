/** 套餐类型 */
export type PlanType = "free" | "single" | "subscription";

/** 订单类型 */
export type OrderType = "single" | "subscription";

/** 订单状态 */
export type OrderStatus = "pending" | "paid" | "refunded" | "cancelled";

/** 支付渠道 */
export type PaymentChannel = "wechat" | "alipay";

/** 当前用户套餐状态 */
export interface Subscription {
  plan: PlanType;
  expiresAt: string | null;
  isActive: boolean;
  features: string[];
}

/** 订单 */
export interface Order {
  id: string;
  userId: string;
  projectId: string | null;
  type: OrderType;
  amount: number;
  status: OrderStatus;
  providerTransactionId: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 订单列表响应 */
export interface OrderListResponse {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
}

/** 创建订单请求 */
export interface CreateOrderRequest {
  planType: OrderType;
  projectId?: string;
}

/** 支付回调请求 */
export interface PaymentNotifyRequest {
  channel: PaymentChannel;
  transactionId: string;
  status: "success" | "failed";
}

/** 单个操作类型的额度信息 */
export interface QuotaItem {
  used: number;
  limit: number;
  remaining: number;
}

/** 用量额度响应 */
export interface QuotaStatus {
  plan: PlanType;
  period: string;
  resetAt: string;
  quotas: Record<string, QuotaItem>;
}
