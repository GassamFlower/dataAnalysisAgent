"use client";

import { Card } from "@/components/ui/card";
import type { ReliabilityResult } from "@/types";

/**
 * 信效度柱状图（纯 SVG，零依赖）。
 * 各维度 α + KMO 分组柱状图，带阈值线（α≥0.70 / KMO≥0.50）。
 * 达标用语义色（success），不达标用 error/warning，一眼识别问题维度。
 */
export function ReliabilityChart({ results }: { results: ReliabilityResult[] }) {
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

  const truncate = (s: string, n: number) =>
    s.length > n ? s.slice(0, n) + "…" : s;

  return (
    <Card className="p-5">
      {/* 图例 */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-caption text-ink-600">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--success)" }}
          />
          Cronbach&apos;s α（达标）
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--destructive)" }}
          />
          α 未达标
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--chart-2)" }}
          />
          KMO（达标）
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--warning)" }}
          />
          KMO 未达标
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

        {/* KMO 阈值线 */}
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
              <rect
                x={alphaX}
                y={y0 - alphaH}
                width={barW}
                height={alphaH}
                rx={2}
                fill={alphaPass ? "var(--success)" : "var(--destructive)"}
              >
                <title>
                  {`${r.dimension} · α = ${r.alpha.toFixed(3)} (${
                    alphaPass ? "达标" : "未达标"
                  })`}
                </title>
              </rect>

              {/* KMO 柱 */}
              <rect
                x={kmoX}
                y={y0 - kmoH}
                width={barW}
                height={kmoH}
                rx={2}
                fill={kmoPass ? "var(--chart-2)" : "var(--warning)"}
              >
                <title>
                  {`${r.dimension} · KMO = ${r.kmo.toFixed(3)} (${
                    kmoPass ? "达标" : "未达标"
                  })`}
                </title>
              </rect>

              {/* X 轴维度标签 */}
              <text
                x={groupCenter}
                y={y0 + 18}
                textAnchor="middle"
                className="fill-ink-600"
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
    </Card>
  );
}
