import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * StatusBadge —— 柔和状态章（soft badge）。
 *
 * 与实心 Badge 的区别：StatusBadge 用于"状态指示"（错误日志标记、
 * 启用/停用、订单状态、权限级别等），采用 tone/10 浅底 + tone/20 边 + tone 文字，
 * 低存在感、可大面积出现在表格行中；实心 Badge 用于"强调/计数"。
 *
 * 颜色全部走 token（--error/--success/--warning/--info），
 * bg-{tone}/10 经 Tailwind 3.4 的 color-mix 对 var() 颜色生效。
 * 历史 admin 区直写 Tailwind 色板的 35 处已收口到本组件。
 */
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        error: "bg-destructive/10 border-destructive/20 text-destructive",
        success: "bg-success/10 border-success/20 text-success",
        warning: "bg-warning/10 border-warning/20 text-warning",
        info: "bg-info/10 border-info/20 text-info",
        neutral: "bg-muted border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {}

function StatusBadge({ className, tone, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props} />
  )
}

export { StatusBadge, statusBadgeVariants }
