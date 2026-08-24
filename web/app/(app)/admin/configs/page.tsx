"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SlidersHorizontal } from "lucide-react";

/**
 * 系统配置与配额管理（F-ADM-003）。
 * v1 为只读运营视图：展示当前系统限制与部署配置分布，避免对 env 值的运行时写入风险。
 * 调整配额阈值/限流等需在生产 env/.env.production 修改后发布（见部署文档）。
 */
const QUOTA_ITEMS = [
  { label: "免费用户项目上限", value: "调 env：FREE_PLAN_PROJECT_LIMIT（默认 3）", desc: "projects 列表侧强制" },
  { label: "免费用户模拟次数 / 周", value: "调 env：FREE_PLAN_SIMULATION_LIMIT_PER_WEEK（默认 3）", desc: "user_quotas 周维度" },
  { label: "免费用户导出次数 / 周", value: "调 env：FREE_PLAN_EXPORT_LIMIT_PER_WEEK（默认 3）", desc: "user_quotas 周维度" },
  { label: "全局限流", value: "调 env：RATE_LIMIT_PER_MINUTE（默认 60）", desc: "slowapi" },
];

export default function AdminConfigsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-900">系统配置与配额</h2>
        <p className="text-sm text-muted-foreground">
          平台配额与限流参数一览（F-ADM-003）
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />免费套餐限制
          </CardTitle>
          <CardDescription>
            这些值由环境变量 / .env.production 控制，调整后需重建配置并重启后端；本页为只读呈现，避免运行时破坏性写入。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {QUOTA_ITEMS.map((q) => (
              <div key={q.label} className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
                <div>
                  <div className="font-medium">{q.label}</div>
                  <div className="text-xs text-muted-foreground">{q.desc}</div>
                </div>
                <code className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs">{q.value}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="rounded-md bg-cream-surface p-3 text-xs text-muted-foreground">
        说明：v1 不对运行时配额/限流做在线写入；如需临时开放某个用户的配额，请在「用户与项目」按用户调整套餐。安全参数（PAYMENT_CALLBACK_TOKEN / PAYMENT_ALLOWED_IPS）与 LLM 密钥同样由部署环境注入，此处不展示明文。
      </p>
    </div>
  );
}