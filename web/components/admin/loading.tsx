import { Loader2 } from "lucide-react";

/**
 * 后台页面加载状态：居中 spinner（与各页现状一致）。
 */
export function PageLoading({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/**
 * 后台表格加载骨架：标题栏渐变行，比纯 spinner 更接近最终布局。
 */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4 rounded-lg border px-4 py-3">
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="h-3.5 animate-pulse rounded bg-ink-100"
              style={{ opacity: 1 - (c * 0.08) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
