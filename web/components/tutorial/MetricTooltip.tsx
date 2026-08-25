"use client";

import Link from "next/link";
import { ArrowRight, HelpCircle, Loader2 } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMetricTooltip } from "@/lib/hooks/use-tutorial";
import { cn } from "@/lib/utils";

interface MetricTooltipProps {
  /** 指标类型（与后端 tutorial_service.py 中 METRIC_TOOLTIPS 的 key 对应） */
  metricType: string;
  /** 自定义触发器内容，默认显示问号图标 */
  children?: React.ReactNode;
  /** 触发器样式 */
  className?: string;
  /** 提示框最大宽度 */
  contentClassName?: string;
}

/** 指标类型 → 统计小课堂对应教程 slug（F-TUT-001 与 F-TUT-002 打通） */
const METRIC_TUTORIAL_SLUG: Record<string, string> = {
  alpha: "cronbach-alpha",
  kmo: "kmo-bartlett",
  bartlett: "kmo-bartlett",
  correlation: "correlation-analysis",
  mean: "descriptive-statistics",
  std: "descriptive-statistics",
  frequency: "descriptive-statistics",
  diagnosis: "writing-results",
  sample_size: "sample-size",
  hit_rate: "sample-size-power",
};

/**
 * 指标解读提示组件。
 *
 * 在报告页各指标旁显示一个可 hover 的问号图标，
 * 弹出通俗易懂的指标解读卡片，并提供跳转到「统计小课堂」对应教程的链接。
 */
export function MetricTooltip({
  metricType,
  children,
  className,
  contentClassName,
}: MetricTooltipProps) {
  const { data: tooltip, isLoading } = useMetricTooltip(metricType);
  const tutorialSlug = METRIC_TUTORIAL_SLUG[metricType];

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-help",
              className
            )}
            aria-label={`查看 ${tooltip?.title ?? metricType} 解读`}
          >
            {children ?? <HelpCircle className="h-4 w-4" />}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          sideOffset={8}
          className={cn(
            "max-w-[320px] space-y-2 p-3 text-left",
            contentClassName
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">加载解读中...</span>
            </div>
          ) : tooltip ? (
            <>
              <h4 className="font-semibold text-foreground">{tooltip.title}</h4>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {tooltip.content}
              </p>
              {tooltip.example && (
                <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">示例：</span>
                  {tooltip.example}
                </div>
              )}
              {tutorialSlug && (
                <Link
                  href={`/learn/${tutorialSlug}`}
                  className="flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
                >
                  去小课堂学原理
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">暂无该指标解读</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
