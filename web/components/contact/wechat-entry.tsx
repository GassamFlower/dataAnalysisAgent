"use client";

import * as React from "react";

import { toast } from "@/components/ui/toaster";
import { useFrontendConfig } from "@/lib/hooks/use-frontend-config";

/**
 * 一键加客服微信（Task 2.3）。
 *
 * 真源在后端 `CUSTOMER_SERVICE_WECHAT_ID`：
 * - 留空 → 占位态：点击提示"敬请期待"（复用微信扫码登录占位交互）。
 * - 填入真实号 → 真实态：点击复制微信号并提示（只改一处 env，前端自动切换，无需改页面代码）。
 */
export interface WechatEntryProps {
  /** 触发节点（将被注入 onClick） */
  trigger: React.ReactNode;
}

export function WechatEntry({ trigger }: WechatEntryProps) {
  const { data } = useFrontendConfig();
  const wechatId = (data?.customer_service_wechat_id ?? "").trim();
  const isPlaceholder = wechatId.length === 0;

  const handleClick = async () => {
    if (isPlaceholder) {
      toast("客服微信即将开放，敬请期待");
      return;
    }
    try {
      await navigator.clipboard.writeText(wechatId);
      toast(`已复制客服微信号：${wechatId}，可在微信搜索添加`);
    } catch {
      toast(`客服微信号：${wechatId}`);
    }
  };

  if (!React.isValidElement(trigger)) {
    return null;
  }
  return React.cloneElement(trigger as React.ReactElement, {
    onClick: handleClick,
  });
}