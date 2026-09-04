import type { ReactNode } from "react";

/**
 * 后台页面统一头部：标题 + 说明 + 右侧操作区。
 * 各 admin 页面共用，保证信息层级与间距一致。
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
