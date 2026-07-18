"use client";

import { User, Receipt, Crown } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { PRICING } from "@/lib/constants";
import { useLogout } from "@/lib/hooks/use-auth";

export default function SettingsPage() {
  const logout = useLogout();

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
                <Badge variant="secondary" className="font-normal">
                  免费体检
                </Badge>
              </div>
              <p className="text-body text-ink-500">
                免费层永久可用。升级解锁数据预演与报告导出。
              </p>
            </div>
            <Button size="sm" asChild>
              <a href="/pricing">升级套餐</a>
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
              <p className="text-body text-ink-500">暂无订单。</p>
            </div>
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
