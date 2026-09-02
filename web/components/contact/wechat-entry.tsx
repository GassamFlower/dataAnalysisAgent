"use client";

import * as React from "react";
import { Copy, MessageCircle } from "lucide-react";

import { toast } from "@/components/ui/toaster";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useFrontendConfig } from "@/lib/hooks/use-frontend-config";

/**
 * 客服微信二维码弹窗。
 *
 * 真源在后端 `CUSTOMER_SERVICE_WECHAT_ID`：
 * - 留空 → 仅展示二维码名片。
 * - 填入真实号 → 同时展示微信号 + 一键复制（依旧只改一处 env，无需改页面代码）。
 *
 * 两位客服的二维码图片放于 `/public/wechat/`，新增 / 替换时只改 `SERVICE_LIST`。
 */
export interface WechatEntryProps {
  /** 触发节点（将被注入 onClick） */
  trigger: React.ReactNode;
}

interface ServiceCard {
  id: string;
  name: string;
  role: string;
  image: string;
}

const SERVICE_LIST: ServiceCard[] = [
  {
    id: "yinuo",
    name: "客服 · 一诺",
    role: "售前咨询 / 课题答疑",
    image: "/wechat/wechat-yinuo.png",
  },
  {
    id: "tianci",
    name: "客服 · 天赐",
    role: "售后支持 / 报告咨询",
    image: "/wechat/wechat-tianci.jpg",
  },
];

export function WechatEntry({ trigger }: WechatEntryProps) {
  const { data } = useFrontendConfig();
  const wechatId = (data?.customer_service_wechat_id ?? "").trim();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleClick = () => {
    setOpen(true);
  };

  const handleCopy = async () => {
    if (!wechatId) return;
    try {
      await navigator.clipboard.writeText(wechatId);
      setCopied(true);
      toast(`已复制客服微信号：${wechatId}，可在微信搜索添加`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(`客服微信号：${wechatId}`);
    }
  };

  if (!React.isValidElement(trigger)) {
    return null;
  }
  const injectedTrigger = React.cloneElement(
    trigger as React.ReactElement,
    { onClick: handleClick }
  );

  return (
    <>
      {injectedTrigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ink-900">
              <MessageCircle className="h-4 w-4 text-primary" />
              添加客服微信
            </DialogTitle>
            <DialogDescription>
              使用微信扫一扫下方二维码，添加客服为好友（请备注来意与课题方向）
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SERVICE_LIST.map((s) => (
              <div
                key={s.id}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-md bg-white">
                  {/* 使用原生 img：Next/Image 在 QR 码场景下会进行尺寸优化，反而降低扫码识别率 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.image}
                    alt={`${s.name} 微信二维码`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-ink-900">
                    {s.name}
                  </div>
                  <div className="text-xs text-ink-500">{s.role}</div>
                </div>
              </div>
            ))}
          </div>

          {wechatId && (
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border border-dashed border-border bg-ink-100/40 px-3 py-2"
              )}
            >
              <div className="min-w-0 flex-1 text-sm text-ink-700">
                微信号：
                <span className="ml-1 select-all font-mono text-ink-900">
                  {wechatId}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-ink-700 transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label="复制微信号"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          )}

          <p className="text-center text-caption text-ink-400">
            工作日 9:00 - 21:00 响应；留言后未及时回复可补充说明课题方向
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
