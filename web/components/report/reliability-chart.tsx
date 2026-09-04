"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import type { ReliabilityResult } from "@/types";

/**
 * 信效度柱状图（纯 SVG，零依赖）。
 * 各维度 α + KMO 分组柱状图，带阈值线（α≥0.70 / KMO≥0.50）。
 * 交互（Task 5.1）：
 *  - 图例可点击筛选：α / KMO 两个系列各自显隐；
 *  - 悬停柱体：显示该维度该指标的取值与达标情况。
 * 达标用语义色（success），不达标用 error/warning，一眼识别问题维度。
 */
export function ReliabilityChart({ results }: { results: ReliabilityResult[] }) {
  const [showAlpha, setShowAlpha] = useState(true);
  const [showKmo, setShowKmo] = useState(true);
  const [hover, setHover] = useState<{ dimension: string; metric: "alpha" | "kmo" } | null>(null);

  if (!results.length) {
    return (
      <Card className="p-6 text-center text-body text-ink-500">
        暂无信效度数据
      </Card>
    );
  }

  const W = 600;
  const H = 280;
  const padL = 48;
  const padR = 16;
  const padT = 28;
  const padB = 52;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const y0 = padT + plotH; // y at value=0
  const yScale = (v: number) => y0 - v * plotH;

  const groupW = plotW / results.length;
  const barW = Math.min(18, groupW * 0.28);
  const gap = 3;

  // Y 轴刻度
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  // 阈值线
  const alphaThreshold = 0.7;
  const kmoThreshold = 0.5;

  const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

  // 标记，供 tooltip 命中判断
  const matchHover = (d: string, m: "alpha" | "kmo" | null) =>
    hover != null && hover.dimension === d && (m === null || hover.metric === m);
  const hitAlpha = (d: string) => matchHover(d, "alpha");
  const hitKmo = (d: string) => matchHover(d, "kmo");

  const hoveredRow = hover
    ? results.find((r) => r.dimension === hover.dimension)
    : null;
  const hoveredValue =
    hoveredRow && hover
      ? hover.metric === "alpha"
        ? { label: "Cronbach's α", value: hoveredRow.alpha, pass: hoveredRow.alpha >= alphaThreshold }
        : { label: "KMO", value: hoveredRow.kmo, pass: hoveredRow.kmo >= kmoThreshold }
      : null;

  return (
    <Card className="relative p-5">
      {/* 图例（可点击筛选系列） */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-caption text-ink-500">
        <button
          type="button"
          onClick={() => setShowAlpha((s) => !s)}
          aria-pressed={showAlpha}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-ink-900 shadow-sm"
        >
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--success)" }}
          />
          Cronbach&apos;s α
          <span className="text-ink-400">
            {showAlpha ? "（达标/未达标）" : "＋"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowKmo((s) => !s)}
          aria-pressed={showKmo}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-ink-900 shadow-sm"
        >
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--chart-2)" }} />
          KMO
          <span className="text-ink-400">{showKmo ? "（达标/未达标）" : "＋"}</span>
        </button>
        <span className="text-ink-400">
          达标实心，未达标用警示色（α 缺红 / KMO 缺金），阈值线 α≥0.70 / KMO≥0.50
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 320 }}
        role="img"
        aria-label="各维度信效度柱状图"
      >
        {/* Y 轴网格线 + 刻度标签 */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padL}
              y1={yScale(tick)}
              x2={W - padR}
              y2={yScale(tick)}
              stroke="var(--border-color)"
              strokeWidth={1}
              strokeDasharray={tick === 0 ? undefined : "2,3"}
              opacity={tick === 0 ? 1 : 0.6}
            />
            <text
              x={padL - 8}
              y={yScale(tick) + 4}
              textAnchor="end"
              className="fill-ink-400"
              style={{ fontSize: 11 }}
            >
              {tick.toFixed(1)}
            </text>
          </g>
        ))}

        {/* α 阈值线 */}
        {showAlpha && (
          <>
            <line
              x1={padL}
              y1={yScale(alphaThreshold)}
              x2={W - padR}
              y2={yScale(alphaThreshold)}
              stroke="var(--destructive)"
              strokeWidth={1.5}
              strokeDasharray="5,4"
              opacity={0.7}
            />
            <text
              x={W - padR - 4}
              y={yScale(alphaThreshold) - 4}
              textAnchor="end"
              className="fill-destructive"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              α≥0.70
            </text>
          </>
        )}

        {/* KMO 阈值线 */}
        {showKmo && (
          <>
            <line
              x1={padL}
              y1={yScale(kmoThreshold)}
              x2={W - padR}
              y2={yScale(kmoThreshold)}
              stroke="var(--warning)"
              strokeWidth={1.5}
              strokeDasharray="5,4"
              opacity={0.5}
            />
            <text
              x={W - padR - 4}
              y={yScale(kmoThreshold) - 4}
              textAnchor="end"
              className="fill-warning"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              KMO≥0.50
            </text>
          </>
        )}

        {/* 柱子 */}
        {results.map((r, i) => {
          const groupCenter = padL + (i + 0.5) * groupW;
          const alphaX = groupCenter - barW - gap / 2;
          const kmoX = groupCenter + gap / 2;
          const alphaPass = r.alpha >= alphaThreshold;
          const kmoPass = r.kmo >= kmoThreshold;
          const alphaH = r.alpha * plotH;
          const kmoH = r.kmo * plotH;

          return (
            <g key={r.dimension}>
              {/* α 柱 */}
              {showAlpha && (
                <rect
                  x={alphaX}
                  y={y0 - alphaH}
                  width={barW}
                  height={alphaH}
                  rx={2}
                  fill={alphaPass ? "var(--success)" : "var(--destructive)"}
                  opacity={hitAlpha(r.dimension) ? 1 : 0.85}
                  onMouseEnter={() => setHover({ dimension: r.dimension, metric: "alpha" })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                />
              )}

              {/* KMO 柱 */}
              {showKmo && (
                <rect
                  x={kmoX}
                  y={y0 - kmoH}
                  width={barW}
                  height={kmoH}
                  rx={2}
                  fill={kmoPass ? "var(--chart-2)" : "var(--warning)"}
                  opacity={hitKmo(r.dimension) ? 1 : 0.85}
                  onMouseEnter={() => setHover({ dimension: r.dimension, metric: "kmo" })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                />
              )}

              {/* X 轴维度标签 */}
              <text
                x={groupCenter}
                y={y0 + 18}
                textAnchor="middle"
                className="fill-ink-500"
                style={{ fontSize: 11 }}
              >
                {truncate(r.dimension, 6)}
              </text>
            </g>
          );
        })}

        {/* X 轴线 */}
        <line
          x1={padL}
          y1={y0}
          x2={W - padR}
          y2={y0}
          stroke="var(--border-color)"
          strokeWidth={1.5}
        />
      </svg>

      {/* 悬停 tooltip */}
      {hoveredValue && hoveredRow && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 w-max max-w-xs -translate-x-1/2 rounded-md border border-border bg-card px-3 py-2 text-caption shadow-md">
          <div className="font-medium text-ink-900">{hoveredRow.dimension}</div>
          <div className="mt-1 text-ink-700">
            {hoveredValue.label} = {hoveredValue.value.toFixed(3)}
          </div>
          <div className={hoveredValue.pass ? "text-success" : "text-destructive"}>
            {hoveredValue.pass ? "● 达标" : "○ 未达标"}
          </div>
        </div>
      )}
    </Card>
  );
}