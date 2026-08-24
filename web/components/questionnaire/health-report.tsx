"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuestionnaireHealth } from "@/lib/hooks/use-questionnaire";

const STATUS_CONFIG = {
  pass: { label: "通过", tone: "default" as const, color: "tone-text-success" },
  warn: { label: "警告", tone: "secondary" as const, color: "tone-text-warning" },
  fail: { label: "不通过", tone: "destructive" as const, color: "tone-text-danger" },
};

const GRADE_CONFIG = {
  A: { label: "优秀", cls: "tone-success-surface" },
  B: { label: "良好", cls: "tone-info-surface" },
  C: { label: "一般", cls: "tone-warning-surface" },
  D: { label: "较差", cls: "tone-danger-surface" },
};

/**
 * 问卷质量体检报告卡片。
 * 展示 7 项规则检查结果、综合得分与优化建议。
 */
export function HealthReport({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useQuestionnaireHealth(projectId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          正在生成体检报告…
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          体检报告加载失败，请先完成题目识别或问卷星导入。
        </CardContent>
      </Card>
    );
  }

  const gradeCfg = GRADE_CONFIG[data.grade as keyof typeof GRADE_CONFIG] ?? GRADE_CONFIG.D;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>问卷质量体检</span>
          <Badge variant="outline" className="font-normal">
            共 {data.totalQuestions} 题
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 综合得分 */}
        <div className={`rounded-lg border p-4 ${gradeCfg.cls}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">
                {data.overallScore}
                <span className="text-sm font-normal text-muted-foreground"> / 100</span>
              </div>
              <div className="text-sm font-medium">
                等级 {data.grade} · {gradeCfg.label}
              </div>
            </div>
            <Progress value={data.overallScore} className="w-32" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{data.summary}</p>
        </div>

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
                  <span className={`text-xs font-medium ${cfg.color}`}>
                    {item.score} 分
                  </span>
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
