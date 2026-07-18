"use client";

import { useState, cloneElement, isValidElement } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PaidActionGuardProps {
  /** 当前用户套餐：free / single / subscription */
  plan: string;
  /** 付费操作触发按钮或任意可点击元素 */
  children: React.ReactElement<{ onClick?: (e: unknown) => void }>;
  /** 弹窗标题，默认"解锁此功能" */
  title?: string;
  /** 弹窗描述，默认提示升级文案 */
  description?: string;
}

/**
 * 付费能力前端引导包装器。
 *
 * - free 用户点击子元素时，拦截点击并弹出升级引导弹窗。
 * - 付费用户直接透传点击事件，子元素正常响应，不挂载弹窗结构。
 */
export function PaidActionGuard({
  plan,
  children,
  title = "解锁此功能",
  description = "当前为免费计划，升级后可生成模拟数据、导出数据集并使用完整分析能力。",
}: PaidActionGuardProps) {
  const [open, setOpen] = useState(false);
  const isFree = plan === "free";

  if (!isFree) {
    return children;
  }

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {wrappedChild}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
