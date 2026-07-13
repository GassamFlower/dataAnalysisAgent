import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { Diagnosis } from "@/types";

/**
 * 判断是否为规则级翻车点（不绑定具体数值，value/threshold 为 0）。
 * 后端 diagnosis_rules 命中的翻车点（如"反向题未反转""未报累计方差"）经兜底为 0。
 */
function isRuleIssue(value: number, threshold: number): boolean {
  return value === 0 && threshold === 0;
}

/**
 * R4 诊断结论展示（宪法第 14 条：B 路线，不达标给修改建议）。
 * 规则引擎命中翻车点 + DeepSeek-R1 补充自然语言原因，合并去重输出。
 */
export function DiagnosisAlert({ diagnosis }: { diagnosis: Diagnosis }) {
  if (diagnosis.passed) {
    return (
      <Card className="flex items-start gap-3 border-success/40 bg-success/5 p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <h4 className="text-h3 font-semibold text-ink-900">整体达标</h4>
          <p className="mt-1 text-body text-ink-700">
            所有关键指标满足信效度阈值，可进入正式数据采集与论文撰写。
          </p>
        </div>
      </Card>
    );
  }

  const ruleCount = diagnosis.issues.filter((i) =>
    isRuleIssue(i.value, i.threshold)
  ).length;
  const metricCount = diagnosis.issues.length - ruleCount;

  return (
    <Card className="border-destructive/40 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <h4 className="text-h3 font-semibold text-destructive">
            检出 {diagnosis.issues.length} 项问题
          </h4>
          <p className="mt-1 text-body text-ink-700">
            {metricCount > 0 && `${metricCount} 项指标未达标`}
            {metricCount > 0 && ruleCount > 0 && "，"}
            {ruleCount > 0 && `${ruleCount} 项规则翻车点`}
            。以下为诊断结论与修改建议，调整后可重新预演。
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {diagnosis.issues.map((issue, i) => {
          const ruleHit = isRuleIssue(issue.value, issue.threshold);
          return (
            <li
              key={i}
              className="rounded-md border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-ink-900">
                  {ruleHit && (
                    <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                  )}
                  {issue.dimension || "全局"} · {issue.metric}
                </span>
                {ruleHit ? (
                  <span className="text-caption font-medium text-warning">
                    规则提示
                  </span>
                ) : (
                  <span className="tabular text-caption text-destructive">
                    {issue.value.toFixed(3)} / 阈值 {issue.threshold.toFixed(3)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-small text-ink-500">{issue.reason}</p>
              <p className="mt-1.5 text-small text-ink-700">
                <span className="font-medium text-accent-indigo">建议：</span>
                {issue.suggestion}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
