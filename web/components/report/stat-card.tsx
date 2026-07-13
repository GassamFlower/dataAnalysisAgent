import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * 统计指标卡。展示单一数值 + 标签 + 是否达标。
 */
export function StatCard({
  label,
  value,
  unit,
  threshold,
  passed = true,
}: {
  label: string;
  value: number | string;
  unit?: string;
  threshold?: string;
  passed?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="text-caption text-ink-500">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={cn(
            "tabular text-3xl font-bold",
            passed ? "text-ink-900" : "text-destructive"
          )}
        >
          {typeof value === "number" ? value.toFixed(3) : value}
        </span>
        {unit ? <span className="text-body text-ink-500">{unit}</span> : null}
      </div>
      {threshold ? (
        <div
          className={cn(
            "mt-2 text-caption",
            passed ? "text-success" : "text-destructive"
          )}
        >
          {passed ? "✓ 达标 · " : "✗ 未达标 · "}
          阈值 {threshold}
        </div>
      ) : null}
    </Card>
  );
}
