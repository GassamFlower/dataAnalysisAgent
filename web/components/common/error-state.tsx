import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 错误状态。用于请求失败 / 异常场景。
 */
export function ErrorState({
  title = "出错了",
  message = "加载失败，请稍后重试。",
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-h3 font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 max-w-sm text-body text-ink-500">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-6" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          重试
        </Button>
      ) : null}
    </div>
  );
}
