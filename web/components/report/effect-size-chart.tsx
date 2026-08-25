"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import type { DiffTestResult } from "@/types";

const LEGEND_VARIANTS = {
  on: "bg-card text-ink-900 border-border shadow-sm",
  off: "bg-transparent text-ink-400 border-transparent",
} as const;

/**
 * 差异检验效应量图（纯 SVG 水平柱状图，零依赖）。
 * 每条假设路径一根柱，长度 = 效应量，颜色区分显著/不显著。
 * 交互（Task 5.1）：
 *  - 图例可点击筛选：只显显著 / 只显不显著；
 *  - 悬停柱体：显示该方法/效应量/p 值/显著性的 tooltip。
 * 标注效应量值 + p 值 + 检验方法，直观展示假设验证结果。
 */
export function EffectSizeChart({ results }: { results: DiffTestResult[] | null }) {
  const [showSignificant, setShowSignificant] = useState(true);
  const [showNonsignificant, setShowNonsignificant] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!results || !results.length) {
    return null; // 无差异检验数据时不渲染，由页面控制展示
  }

  // 过滤掉有 error 或无 effectSize 的项
  const valid = results.filter((r) => r.effectSize != null && !r.error);
  if (!valid.length) {
    return (
      <Card className="p-6 text-center text-body text-ink-500">
        差异检验未产生有效效应量数据
      </Card>
    );
  }

  // 应用图例筛选：悬停索引需落在可见项上，故基于可见子集重算
  const visible = valid.filter(
    (r) =>
      (r.significant ?? (r.pValue != null && r.pValue < 0.05))
        ? showSignificant
        : showNonsignificant
  );

  const maxEffect = Math.max(1.0, ...valid.map((r) => Math.abs(r.effectSize!)));
  const effectSizeName = valid[0]?.effectSizeName || "r";
  const barAreaW = 320;
  const rowH = 56;
  const labelH = 20;
  const padL = 10;
  const padR = 100; // 右侧标注区
  const W = padL + 200 + barAreaW + padR; // 200 = 路径标签区
  const H = 10 + (visible.length || 1) * rowH + 10;

  const truncate = (s: string, n: number) =>
    s.length > n ? s.slice(0, n) + "…" : s;

  const formatP = (p: number | null | undefined) => {
    if (p == null) return "—";
    if (p < 0.001) return "p<0.001";
    return `p=${p.toFixed(3)}`;
  };

  const isSignificant = (r: DiffTestResult) =>
    r.significant ?? (r.pValue != null && r.pValue < 0.05);

  const hovered = hoverIdx != null ? visible[hoverIdx] : null;

  return (
    <Card className="relative p-5">
      {/* 图例（可点击筛选） */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-caption text-ink-600">
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSignificant((s) => !s)}
            aria-pressed={showSignificant}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 transition-colors ${
              LEGEND_VARIANTS[showSignificant ? "on" : "off"]
            }`}
          >
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: "var(--chart-1)" }}
            />
            显著（p&lt;0.05）
            <span className="text-ink-400">{showSignificant ? "×" : "＋"}</span>
          </button>
        </span>
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowNonsignificant((s) => !s)}
            aria-pressed={showNonsignificant}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 transition-colors ${
              LEGEND_VARIANTS[showNonsignificant ? "on" : "off"]
            }`}
          >
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: "var(--ink-400)" }}
            />
            不显著
            <span className="text-ink-400">{showNonsignificant ? "×" : "＋"}</span>
          </button>
        </span>
        <span className="text-ink-400">
          虚线 = 小/中/大效应量阈值（{effectSizeName}）
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="py-4 text-center text-body text-ink-500">
          当前筛选下无高亮的假设路径，取消图例筛选查看全部。
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: H }}
          role="img"
          aria-label="假设检验效应量柱状图"
        >
          {visible.map((r, i) => {
            const y = 10 + i * rowH;
            const barY = y + labelH;
            const barH = 20;
            const effect = Math.abs(r.effectSize!);
            const barW = (effect / maxEffect) * barAreaW;
            const significant = isSignificant(r);
            const fillColor = significant ? "var(--chart-1)" : "var(--ink-400)";
            const pathLabel = `${truncate(r.predictor, 8)} → ${truncate(r.outcome, 8)}`;
            const barLeft = padL + 200;

            // 效应量阈值虚线（0.2/0.4/0.6 for r-like, 或 0.1/0.3/0.5）
            const thresholds = [0.2, 0.4, 0.6];

            return (
              <g
                key={i}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx((p) => (p === i ? null : p))}
                style={{ cursor: "pointer" }}
              >
                {/* 路径标签 */}
                <text
                  x={padL}
                  y={y + 14}
                  className="fill-ink-700"
                  style={{ fontSize: 12, fontWeight: 500 }}
                >
                  {pathLabel}
                </text>

                {/* 阈值虚线 */}
                {thresholds.map((t) => {
                  const tx = barLeft + (t / maxEffect) * barAreaW;
                  if (tx > barLeft + barAreaW) return null;
                  return (
                    <line
                      key={t}
                      x1={tx}
                      y1={barY - 2}
                      x2={tx}
                      y2={barY + barH + 2}
                      stroke="var(--border-color)"
                      strokeWidth={1}
                      strokeDasharray="2,2"
                      opacity={0.6}
                    />
                  );
                })}

                {/* 效应量柱 */}
                <rect
                  x={barLeft}
                  y={barY}
                  width={Math.max(barW, 2)}
                  height={barH}
                  rx={3}
                  fill={fillColor}
                  opacity={hoverIdx === i ? 1 : 0.85}
                />

                {/* 效应量值 */}
                <text
                  x={barLeft + Math.max(barW, 2) + 6}
                  y={barY + 14}
                  className="fill-ink-700"
                  style={{ fontSize: 11 }}
                >
                  {r.effectSizeName || "r"}={r.effectSize!.toFixed(2)}
                </text>

                {/* p 值 + 显著性标记 */}
                <text
                  x={barLeft + barAreaW + 10}
                  y={barY + 14}
                  className={significant ? "fill-success" : "fill-ink-400"}
                  style={{ fontSize: 11, fontWeight: significant ? 600 : 400 }}
                >
                  {formatP(r.pValue)}
                  {significant ? " *" : ""}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* 悬停 tooltip */}
      {hovered && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 w-max max-w-xs -translate-x-1/2 rounded-md border border-border bg-card px-3 py-2 text-caption shadow-md">
          <div className="font-medium text-ink-900">
            {hovered.predictor} → {hovered.outcome}
          </div>
          <div className="mt-1 space-y-0.5 text-ink-600">
            <div>方法：{hovered.methodName || hovered.method || "—"}</div>
            <div>
              {hovered.effectSizeName || "r"} = {hovered.effectSize!.toFixed(3)}
              {hovered.effectSizeGrade ? `（${hovered.effectSizeGrade}）` : ""}
            </div>
            <div>{formatP(hovered.pValue)}</div>
            <div className={isSignificant(hovered) ? "text-success" : "text-ink-400"}>
              {isSignificant(hovered) ? "● 显著" : "○ 不显著"}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}