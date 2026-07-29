"use client";

import { HelpCircle, Loader2 } from "lucide-react";

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

/**
 * 指标解读提示组件。
 *
 * 在报告页各指标旁显示一个可 hover 的问号图标，
 * 弹出通俗易懂的指标解读卡片。
 */
export function MetricTooltip({
  metricType,
  children,
  className,
  contentClassName,
}: MetricTooltipProps) {
  const { data: tooltip, isLoading } = useMetricTooltip(metricType);

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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">暂无该指标解读</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
