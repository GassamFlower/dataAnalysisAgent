"use client";

import { AlertTriangle } from "lucide-react";

interface SimulationReportBannerProps {
  /** 项目模式：仅在 simulation 模式下显示 */
  projectMode?: "real" | "simulation";
}

/**
 * 模拟数据报告 Banner 组件。
 *
 * 在报告页面顶部固定显示，提醒用户当前分析的是模拟数据。
 * 不可关闭，仅在 projectMode 为 simulation 时渲染。
 */
export function SimulationReportBanner({
  projectMode,
}: SimulationReportBannerProps) {
  if (projectMode !== "simulation") {
    return null;
  }

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
      </div>
    </div>
  );
}
