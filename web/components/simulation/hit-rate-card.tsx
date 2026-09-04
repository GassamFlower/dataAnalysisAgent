"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { HitRateSummary } from "@/types";

/** 将命中率分数格式化为百分比（保留整数） */
function fmtPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * 预演命中率卡片。
 * 每条假设路径展示统计检验功效（检验到显著所需的概率），并标出未达标路径。
 */
export function HitRateCard({ hitRate }: { hitRate: HitRateSummary }) {
  const failedPaths = hitRate.paths.filter((p) => !p.passed);

  return (
    <Card className="p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-h3 font-semibold text-ink-900">预演命中率</h3>
          <p className="mt-1 text-body text-ink-500">
            在当前样本量下，每条假设路径能检验出显著效应的把握度（统计功效，目标
            ≥{fmtPct(hitRate.paths[0]?.target ?? 0.7)}）。
          </p>
        </div>
        <div
          className={`shrink-0 rounded-xl px-4 py-2 text-center ${
            failedPaths.length === 0
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
          }`}
        >
          <div className="text-2xl font-bold leading-tight">
            {fmtPct(hitRate.overall)}
          </div>
          <div className="text-caption">
            {hitRate.passedCount}/{hitRate.totalCount} 条达标
          </div>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {hitRate.paths.map((p) => (
          <li
            key={`${p.predictor}->${p.outcome}`}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              {p.passed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              )}
              <span className="truncate text-body text-ink-700">
                {p.predictor}
                <span className="mx-1 text-ink-400">→</span>
                {p.outcome}
                <span className="ml-1.5 text-caption text-ink-400">
                  {p.direction === "negative" ? "-" : "+"}
                  {p.passed ? "强" : ""}
                </span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="w-12 text-right text-body font-medium">
                {fmtPct(p.hitRate)}
              </div>
              {!p.passed && (
                <span className="rounded bg-warning/10 px-1.5 py-0.5 text-caption text-warning">
                  未达标
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {failedPaths.length > 0 && (
        <p className="mt-4 rounded-lg bg-warning/5 p-3 text-caption text-ink-500">
          有 {failedPaths.length} 条假设在当前样本量下检验功效不足，建议增加样本量
          在“样本量规划”中使用，或调整假设路径的预期相关强度。
        </p>
      )}
    </Card>
  );
}