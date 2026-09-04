"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, SlidersHorizontal, RefreshCw, Save } from "lucide-react";

import { adminApi, type QuotaLimitItem } from "@/lib/api/admin";
import { PageHeader } from "@/components/admin/page-header";
import { PageLoading } from "@/components/admin/loading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * 系统配置与配额管理（F-ADM-003 增强）。
 * 现支持运行时调整各动作的「免费配额周上限」，即时生效并写审计；其余参数为部署层只读。
 */
const EDITABLE_HINT =
  "下方「免费配额」可在运行时调整并实时生效（写审计留痕）；项目数/全局限流等部署参数仍在 .env 中调节后发布，当前为只读展示。";

export default function AdminConfigsPage() {
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-quota-limits"],
    queryFn: () => adminApi.getQuotaLimits(),
  });

  // 每个动作的本地编辑值（Key=action，Value=当前输入）
  const [edits, setEdits] = useState<Record<string, string>>({});

  const update = useMutation({
    mutationFn: (v: { action: string; value: number }) =>
      adminApi.updateQuotaLimit(v.action, v.value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quota-limits"] });
      setEdits({});
      toast.success("配额已更新并生效");
    },
    onError: () => toast.error("更新失败，请检查输入值（须为非负整数）"),
  });

  const items: QuotaLimitItem[] = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统配置与配额"
        description="平台配额运行时可调参数一览（F-ADM-003）"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin-quota-limits"] })}
          >
            <RefreshCw className="mr-1 h-3 w-3" />刷新
          </Button>
        }
      />

      <p className="rounded-md bg-cream-surface p-3 text-xs text-muted-foreground">
        {EDITABLE_HINT}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />免费套餐配额（每周，可运行时调整）
          </CardTitle>
          <CardDescription>
            调整后实时生效并持久化。来源标注「默认」= 服务端默认值；「覆盖」= 后台已调整。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <PageLoading />}
          {isError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              加载失败，请确认有管理员权限。
            </p>
          )}

          {!isLoading && !isError && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => {
                const dirty =
                  edits[item.action] !== undefined &&
                  Number(edits[item.action]) !== item.value;
                return (
                  <div
                    key={item.action}
                    className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"
                  >
                    <div className="min-w-[140px]">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.action}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={item.source === "override" ? "default" : "outline"}
                      >
                        {item.source === "override" ? "已覆盖" : "默认"}
                      </Badge>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-20 text-sm"
                        value={edits[item.action] ?? String(item.value)}
                        onChange={(e) =>
                          setEdits((prev) => ({ ...prev, [item.action]: e.target.value }))
                        }
                      />
                      <span className="text-xs text-muted-foreground">次/周</span>
                      {dirty && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={update.isPending}
                          onClick={() => {
                            const v = Number(edits[item.action]);
                            if (!Number.isInteger(v) || v < 0) {
                              toast.error("请输入非负整数");
                              return;
                            }
                            update.mutate({ action: item.action, value: v });
                          }}
                        >
                          {update.isPending ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="mr-1 h-3 w-3" />
                          )}
                          保存
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <p className="text-sm text-muted-foreground">暂无配额项</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="rounded-md bg-cream-surface p-3 text-xs text-muted-foreground">
        说明：如需调整全局限流或单次金额等部署参数，请在 `.env.production` 修改后重建重启。
        安全参数（PAYMENT_CALLBACK_TOKEN / LLM 密钥）由部署环境注入，此处不展示明文。
      </p>
    </div>
  );
}