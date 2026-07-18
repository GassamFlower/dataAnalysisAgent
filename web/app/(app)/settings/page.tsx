"use client";

import { User, Receipt, Crown, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { PRICING } from "@/lib/constants";
import { useLogout } from "@/lib/hooks/use-auth";
import { useOrders, useSubscription } from "@/lib/hooks/use-payment";
import type { Order, PlanType, OrderStatus } from "@/types/payment";

const PLAN_LABELS: Record<PlanType, string> = {
  free: "免费体检",
  single: "单次报告",
  subscription: "月度订阅",
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "待支付",
  paid: "已支付",
  refunded: "已退款",
  cancelled: "已取消",
};

const ORDER_STATUS_VARIANTS: Record<OrderStatus, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pending: "warning",
  paid: "success",
  refunded: "secondary",
  cancelled: "destructive",
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrderRow({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-900">
            {PLAN_LABELS[order.type]}
          </span>
          <Badge variant={ORDER_STATUS_VARIANTS[order.status]} className="font-normal">
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-ink-500">订单号：{order.id}</p>
      </div>
      <div className="text-left sm:text-right">
        <p className="font-semibold text-ink-900">¥{order.amount.toFixed(1)}</p>
        <p className="text-sm text-ink-500">{formatDate(order.createdAt)}</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const logout = useLogout();
  const { data: subscription, isLoading: isLoadingSubscription } = useSubscription();
  const { data: ordersData, isLoading: isLoadingOrders } = useOrders();

  const currentPlan = subscription?.plan ?? "free";
  const planName = PLAN_LABELS[currentPlan];

  return (
    <div>
      <PageHeader title="设置" description="账号信息、订阅与订单。" />

      <div className="space-y-6">
        {/* 账号信息 */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-muted text-ink-500">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-h3 font-semibold text-ink-900">账号</h3>
              <p className="text-body text-ink-500">微信用户 · 已登录</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              退出登录
            </Button>
          </div>
        </Card>

        {/* 当前订阅 */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Crown className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-h3 font-semibold text-ink-900">当前套餐</h3>
                {isLoadingSubscription ? (
                  <span className="text-ink-500">加载中…</span>
                ) : (
                  <Badge variant={currentPlan === "free" ? "secondary" : "success"} className="font-normal">
                    {planName}
                  </Badge>
                )}
              </div>
              <p className="text-body text-ink-500">
                {currentPlan === "free" && "免费层永久可用。升级解锁数据预演与报告导出。"}
                {currentPlan === "single" && `单次报告套餐${subscription?.isActive && subscription.expiresAt ? `，有效期至 ${formatDate(subscription.expiresAt)}` : ""}。`}
                {currentPlan === "subscription" && `月度订阅${subscription?.isActive && subscription.expiresAt ? `，有效期至 ${formatDate(subscription.expiresAt)}` : ""}，不限次预演。`}
              </p>
            </div>
            <Button size="sm" asChild>
              <a href="/pricing">{currentPlan === "free" ? "升级套餐" : "续费/变更"}</a>
            </Button>
          </div>
        </Card>

        {/* 订单 */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-muted text-ink-500">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-h3 font-semibold text-ink-900">订单记录</h3>
            </div>
          </div>

          <div className="mt-4">
            {isLoadingOrders ? (
              <div className="flex items-center justify-center py-8 text-ink-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中…
              </div>
            ) : ordersData && ordersData.orders.length > 0 ? (
              <div className="divide-y divide-border">
                {ordersData.orders.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </div>
            ) : (
              <p className="text-body text-ink-500">暂无订单。</p>
            )}
          </div>
        </Card>

        {/* 套餐说明 */}
        <Card className="bg-cream-surface p-6">
          <h3 className="text-h3 font-semibold text-ink-900">套餐说明</h3>
          <ul className="mt-3 space-y-2 text-body text-ink-700">
            <li>
              · {PRICING.free.name}：¥{PRICING.free.price}，永久免费
            </li>
            <li>
              · {PRICING.single.name}：¥{PRICING.single.price}
              {PRICING.single.unit}，含 1 次完整预演
            </li>
            <li>
              · {PRICING.subscription.name}：¥{PRICING.subscription.price}
              {PRICING.subscription.unit}，不限次预演
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
