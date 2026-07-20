"use client";

import { useState, cloneElement, isValidElement } from "react";
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
  children: React.ReactElement<{ onClick?: (e: unknown) => void }>;
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
 * - 付费用户直接透传点击事件，不挂载弹窗。
 * - 免费用户有剩余额度时放行，并在按钮上显示剩余次数。
 * - 免费用户额度用尽时拦截点击并弹出升级引导弹窗。
 */
export function PaidActionGuard({
  plan,
  actionType,
  children,
  title = "解锁此功能",
  description = "当前为免费计划，升级后可生成模拟数据、导出数据集并使用完整分析能力。",
}: PaidActionGuardProps) {
  const [open, setOpen] = useState(false);
  const { data: quotaData } = useQuota();

  const isFree = plan === "free";
  const quota = actionType && quotaData?.quotas?.[actionType];
  const remaining = quota?.remaining ?? 0;
  const exhausted = isFree && quota && remaining <= 0;

  // 付费用户或无 actionType 时直接透传
  if (!isFree || !actionType) {
    return children;
  }

  // 额度用尽：拦截点击，弹升级弹窗
  if (exhausted) {
    const wrappedChild = isValidElement(children)
      ? cloneElement(children, {
          onClick: (e: React.MouseEvent | unknown) => {
            if (e && typeof e === "object") {
              (e as { preventDefault?: () => void }).preventDefault?.();
              (e as { stopPropagation?: () => void }).stopPropagation?.();
            }
            setOpen(true);
          },
        })
      : children;

    const actionLabel = ACTION_LABELS[actionType] ?? "此功能";
    const resetDate = quotaData?.resetAt
      ? new Date(quotaData.resetAt).toLocaleDateString("zh-CN", {
          month: "long",
          day: "numeric",
          weekday: "long",
        })
      : "下周一";

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {wrappedChild}
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
