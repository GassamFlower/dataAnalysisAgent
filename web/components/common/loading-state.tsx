import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 加载状态。用于页面级 / 区块级加载。
 */
export function LoadingState({
  label = "加载中...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16",
        className
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-body text-ink-500">{label}</p>
    </div>
  );
}
