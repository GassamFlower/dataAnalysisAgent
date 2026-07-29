import { MetricTooltip } from "@/components/tutorial/MetricTooltip";
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
  tooltipType,
}: {
  label: string;
  value: number | string;
  unit?: string;
  threshold?: string;
  passed?: boolean;
  /** 指标解读类型（与 tutorial_service.py 中 METRIC_TOOLTIPS 的 key 对应） */
  tooltipType?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-1.5 text-caption text-ink-500">
        {label}
        {tooltipType ? <MetricTooltip metricType={tooltipType} /> : null}
      </div>
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
