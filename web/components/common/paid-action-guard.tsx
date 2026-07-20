"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuota } from "@/lib/hooks/use-payment";

interface PaidActionGuardProps {
  /** 当前用户套餐：free / single / subscription */
  plan: string;
  /** 付费操作类型：simulation / export / analysis */
  actionType?: "simulation" | "export" | "analysis";
  /** 付费操作触发按钮或任意可点击元素 */
  children: React.ReactElement;
  /** 弹窗标题，默认"解锁此功能" */
  title?: string;
  /** 弹窗描述，默认提示升级文案 */
  description?: string;
}

const ACTION_LABELS: Record<string, string> = {
  simulation: "模拟生成",
  export: "数据导出",
  analysis: "分析报告",
};

/**
 * 付费能力前端引导包装器。
 *
 * - 付费用户直接透传，不挂载弹窗。
 * - 免费用户有剩余额度时放行，并显示剩余次数徽章。
 * - 免费用户额度用尽时拦截点击，弹升级引导弹窗。
 *
 * 注意：使用外层 div 拦截点击（而非 cloneElement），
 * 因为 Radix/Slot 组件的 onClick 合并行为会导致 cloneElement 无法覆盖原 handler。
 */
export function PaidActionGuard({
  plan,
  actionType,
  children,
  title = "解锁此功能",
}: PaidActionGuardProps) {
  const [open, setOpen] = useState(false);
  const { data: quotaData } = useQuota();

  const isFree = plan === "free";
  const quota = actionType && quotaData?.quotas?.[actionType];
  const remaining = quota?.remaining ?? 0;
  const exhausted = isFree && actionType && remaining <= 0;

  // 付费用户或无 actionType 时直接透传
  if (!isFree || !actionType) {
    return children;
  }

  const actionLabel = ACTION_LABELS[actionType] ?? "此功能";
  const resetDate = quotaData?.resetAt
    ? new Date(quotaData.resetAt).toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "long",
      })
    : "下周一";

  // 额度用尽：用透明覆盖层拦截点击（pointer-events 方案）
  // Radix/Slot 组件会合并 onClick 而非替换，所以必须用 CSS 层阻止点击到达子元素
  if (exhausted) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="relative inline-flex">
          <div className="pointer-events-none">{children}</div>
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }}
          />
        </div>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {title}
            </DialogTitle>
            <DialogDescription>
              本周{actionLabel}次数已用完（{quota?.limit}次）。
              {resetDate}自动重置，或升级套餐解锁无限次数。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              暂不升级
            </Button>
            <Button asChild>
              <Link href="/pricing">查看套餐</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 有剩余额度：放行点击，显示剩余次数
  return (
    <div className="relative inline-flex items-center">
      {children}
      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        本周剩余 {remaining}/{quota?.limit}
      </span>
    </div>
  );
}
