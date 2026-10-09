"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";

interface AlipayQrModalProps {
  open: boolean;
  qrCode: string;
  onClose: () => void;
}

/**
 * 支付宝扫码支付弹窗：展示支付二维码 + 支付结果轮询提示。
 */
export function AlipayQrModal({ open, qrCode, onClose }: AlipayQrModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !qrCode) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h3 className="text-h3 font-semibold text-ink-900">支付宝扫码支付</h3>
          <p className="mt-1 text-body text-ink-500">
            请使用支付宝扫一扫，扫描下方二维码完成支付
          </p>
        </div>

        <div className="mx-auto mt-4 w-fit rounded-lg border border-border bg-card p-3">
          <QRCodeSVG value={qrCode} size={220} />
        </div>

        <p className="mt-4 text-center text-caption text-ink-400">
          支付完成后本页面将自动跳转，请勿关闭此窗口
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md border border-border py-2 text-center text-body font-medium text-ink-700 hover:bg-muted"
        >
          取消支付
        </button>
      </div>
    </div>
  );
}
