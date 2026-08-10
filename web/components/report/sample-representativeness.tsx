"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Users, Ban } from "lucide-react";
import { useSampleRepresentativeness } from "@/lib/hooks/use-report";

const STATUS_CONFIG = {
  pass: { label: "通过", tone: "default" as const, color: "text-emerald-600", bar: "bg-emerald-500" },
  warn: { label: "警告", tone: "secondary" as const, color: "text-amber-600", bar: "bg-amber-500" },
  fail: { label: "不通过", tone: "destructive" as const, color: "text-red-600", bar: "bg-red-500" },
};

const GRADE_CONFIG = {
  A: { label: "优秀", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  B: { label: "良好", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  C: { label: "一般", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  D: { label: "较差", color: "text-red-600", bg: "bg-red-50 border-red-200" },
};

/**
 * 样本代表性诊断卡片（F-RPT-007）。
 * 仅真实数据项目支持：展示样本量、人口学分布、规则检查项与 AI 说人话结论。
 * 只做诊断与改进建议，不提供样本购买/投放/收集服务。
 */
export function SampleRepresentativeness({
  projectId,
}: {
  projectId: string;
}) {
  const { data, isLoading, isError } = useSampleRepresentativeness(projectId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          正在生成样本代表性诊断…
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          样本代表性诊断加载失败，请稍后重试。
        </CardContent>
      </Card>
    );
  }

  // 模拟数据项目不支持
  if (!data.supported) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 py-6">
          <Ban className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" />
          <p className="text-sm text-muted-foreground">{data.message}</p>
        </CardContent>
      </Card>
    );
  }

  // 未检测到人口学变量
  if (!data.hasDemographic) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 py-6">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-ink-900">未检测到人口学变量</p>
            <p className="mt-1 text-sm text-muted-foreground">{data.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const gradeCfg = GRADE_CONFIG[data.grade as keyof typeof GRADE_CONFIG] ?? GRADE_CONFIG.C;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>样本代表性诊断</span>
          <Badge variant="outline" className="font-normal">
            N = {data.sampleSize}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 综合得分 */}
        <div className={`rounded-lg border p-4 ${gradeCfg.bg}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">
                <span className={gradeCfg.color}>{data.overallScore}</span>
                <span className="text-sm font-normal text-muted-foreground"> / 100</span>
              </div>
              <div className={`text-sm font-medium ${gradeCfg.color}`}>
                等级 {data.grade} · {gradeCfg.label}
              </div>
            </div>
            <Progress value={data.overallScore} className="w-32" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{data.summary}</p>
        </div>

        {/* AI 说人话结论 */}
        {data.aiConclusion && (
          <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="text-sm text-ink-800">{data.aiConclusion}</div>
          </div>
        )}

        {/* 人口学分布 */}
        {data.distributions.length > 0 && (
          <div className="space-y-3">
            {data.distributions.map((d) => (
              <div key={d.index} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-900">
                    {d.label}（q{d.index}）
                  </span>
                  <span className="text-muted-foreground">
                    {d.total} 条 · 最高占 {Math.round(d.topShare * 100)}%
                  </span>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                  {Object.entries(d.counts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, count]) => (
                      <div
                        key={cat}
                        className="h-full bg-primary/60"
                        style={{ width: `${(count / d.total) * 100}%` }}
                        title={`${cat}: ${count}`}
                      />
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Object.entries(d.counts)
                    .map(([cat, count]) => `${cat} ${count}（${Math.round((count / d.total) * 100)}%）`)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 检查项列表 */}
        <div className="space-y-3">
          {data.items.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            return (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <Badge variant={cfg.tone} className="font-normal">
                      {cfg.label}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{item.message}</p>
                {item.suggestion && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">建议：</span>
                    {item.suggestion}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
