import { cn } from "@/lib/utils";

/**
 * 页面标题区。统一各页面顶部的标题 / 描述 / 操作三段式。
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex items-start justify-between gap-6", className)}>
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-body-lg text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
