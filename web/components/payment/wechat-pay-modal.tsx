"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";

interface WechatPayQrModalProps {
  open: boolean;
  codeUrl: string;
  onClose: () => void;
}

/**
 * 微信扫码支付弹窗：展示支付二维码 + 支付结果轮询提示。
 * 使用 qrcode.react（已在依赖中）渲染 code_url。
 */
export function WechatPayQrModal({ open, codeUrl, onClose }: WechatPayQrModalProps) {
  // 监听 Escape 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !codeUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h3 className="text-lg font-semibold text-ink-900">微信扫码支付</h3>
          <p className="mt-1 text-sm text-ink-500">
            请使用微信扫一扫，扫描下方二维码完成支付
          </p>
        </div>

        <div className="mx-auto mt-4 w-fit rounded-lg border border-border bg-white p-3">
          <QRCodeSVG value={codeUrl} size={220} />
        </div>

        <p className="mt-4 text-center text-xs text-ink-400">
          支付完成后本页面将自动跳转，请勿关闭此窗口
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md border border-border py-2 text-center text-sm font-medium text-ink-700 hover:bg-muted"
        >
          取消支付
        </button>
      </div>
    </div>
  );
}