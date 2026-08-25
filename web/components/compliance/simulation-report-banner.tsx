"use client";

import { AlertTriangle, Target } from "lucide-react";

import { MetricTooltip } from "@/components/tutorial/MetricTooltip";
import type { HitRateSummary } from "@/types";

interface SimulationReportBannerProps {
  /** 项目模式：仅在 simulation 模式下显示 */
  projectMode?: "real" | "simulation";
  /** 预演命中率汇总（已生成过预演时由报告页注入，用于标注达标情况与失效假设） */
  hitRate?: HitRateSummary | null;
}

/** 将命中率分数格式化为百分比（保留整数） */
function fmtPct(value: number): string {
  return `${Math.round(((value ?? 0) * 100))}%`;
}

/**
 * 模拟数据报告 Banner 组件。
 *
 * 在报告页面顶部固定显示，提醒用户当前分析的是模拟数据。
 * 不可关闭，仅在 projectMode 为 simulation 时渲染。
 * 若传入预演命中率，额外标注总体命中率与未达标假设路径（预演→报告传导）。
 */
export function SimulationReportBanner({
  projectMode,
  hitRate,
}: SimulationReportBannerProps) {
  if (projectMode !== "simulation") {
    return null;
  }

  const failedPaths = (hitRate?.paths ?? []).filter((p) => !p.passed);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
      <div className="flex-1 space-y-1">
        <h4 className="text-sm font-semibold text-ink-900">
          模拟数据分析报告
        </h4>
        <p className="text-xs leading-relaxed text-ink-700">
          本报告基于模拟数据生成，<strong>仅供学习和研究参考</strong>，不得用于正式学术论文。
          如需用于正式研究，请基于真实调研数据重新分析。
        </p>

        {hitRate && (
          <div className="mt-2 rounded-md bg-background/60 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-900">
              <Target className="h-3.5 w-3.5 text-ink-500" />
              预演命中率 {fmtPct(hitRate.overall)}
              <MetricTooltip metricType="hit_rate" className="h-4 w-4 text-ink-400" />
              <span className={failedPaths.length === 0 ? "text-success" : "text-warning"}>
                {hitRate.passedCount}/{hitRate.totalCount} 条达标
              </span>
            </div>
            {failedPaths.length > 0 && (
              <ul className="mt-2 space-y-1">
                {failedPaths.map((p) => (
                  <li key={`${p.predictor}->${p.outcome}`} className="text-xs text-ink-700">
                    {p.predictor} → {p.outcome}（命中率 {fmtPct(p.hitRate)}，未达标）
                    <span className="ml-1 text-ink-400">建议增大样本量后再回收</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}