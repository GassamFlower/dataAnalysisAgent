"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * 全局 Toast（sonner）。
 * 在 Providers 中挂载，业务代码通过 toast() / toast.success() / toast.error() 调用。
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="light"
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-border bg-card px-4 py-3 text-body text-ink-900 shadow-md",
          success: "border-success/30 bg-success/5",
          error: "border-destructive/30 bg-destructive/5",
          warning: "border-warning/30 bg-warning/5",
        },
      }}
    />
  );
}

export { toast };
