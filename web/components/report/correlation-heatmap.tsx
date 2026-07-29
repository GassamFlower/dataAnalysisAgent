"use client";

import { useState } from "react";

import type { CorrelationMatrix } from "@/types";

/**
 * 相关矩阵热力图（报告页只读展示）。
 * 纯 SVG 实现，零依赖。
 * 颜色映射：|r| 越大颜色越深；r > 0 暖橙（chart-1），r < 0 冷青（chart-4），r ≈ 0 透明。
 * 鼠标 hover 显示「维度A ↔ 维度B: r = 0.50」。
 */
export function CorrelationHeatmap({ matrix }: { matrix: CorrelationMatrix }) {
  const { dimensions, cells } = matrix;
  const n = dimensions.length;
  const [hover, setHover] = useState<{
    row: number;
    col: number;
    value: number;
  } | null>(null);

  if (n === 0 || !cells?.length) return null;

  const cellSize = 52;
  const labelWidth = 110;
  const labelHeight = 60;
  const totalWidth = labelWidth + n * cellSize + 20;
  const totalHeight = labelHeight + n * cellSize + 30;

  /** 根据相关值返回颜色对象（fill 用 token，opacity 控制深度） */
  const colorFor = (v: number): { fill: string; opacity: number } => {
    const abs = Math.abs(v);
    if (abs < 0.05) return { fill: "transparent", opacity: 0 };
    // 正相关：砖红 chart-1，负相关：橄榄 chart-4（颜色取自 design tokens，禁止硬编码）
    const alpha = Math.min(0.15 + abs * 0.85, 0.95);
    return {
      fill: v > 0 ? "var(--chart-1)" : "var(--chart-4)",
      opacity: Number(alpha.toFixed(2)),
    };
  };

  /** 文字颜色：背景深时用白，浅时用主色 */
  const textColorFor = (v: number): string => {
    const abs = Math.abs(v);
    return abs > 0.55 ? "var(--bg-elevated)" : "var(--ink-900)";
  };

  return (
    <div className="relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="block max-w-full"
        style={{ minWidth: `${totalWidth * 0.6}px` }}
      >
        {/* 列标签（顶部，斜 45°） */}
        <g transform={`translate(${labelWidth}, ${labelHeight - 8})`}>
          {dimensions.map((d, j) => (
            <text
              key={`col-${j}`}
              x={j * cellSize + cellSize / 2}
              y={0}
              textAnchor="start"
              transform={`rotate(-45, ${j * cellSize + cellSize / 2}, 0)`}
              className="fill-ink-600"
              style={{ fontSize: "11px" }}
            >
              {d}
            </text>
          ))}
        </g>

        {/* 行标签（左侧） */}
        <g transform={`translate(0, ${labelHeight})`}>
          {dimensions.map((d, i) => (
            <text
              key={`row-${i}`}
              x={labelWidth - 8}
              y={i * cellSize + cellSize / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink-700"
              style={{ fontSize: "12px", fontWeight: 500 }}
            >
              {d}
            </text>
          ))}
        </g>

        {/* 单元格 */}
        <g transform={`translate(${labelWidth}, ${labelHeight})`}>
          {dimensions.map((rowDim, i) =>
            dimensions.map((colDim, j) => {
              const cell = cells[i]?.[j];
              const isDiagonal = i === j;
              const value = cell?.value ?? 0;
              const color = isDiagonal
                ? { fill: "var(--bg-muted)", opacity: 1 }
                : colorFor(value);
              const textColor = isDiagonal ? "var(--ink-400)" : textColorFor(value);
              return (
                <g
                  key={`${i}-${j}`}
                  onMouseEnter={() =>
                    !isDiagonal &&
                    setHover({ row: i, col: j, value })
                  }
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: isDiagonal ? "default" : "pointer" }}
                >
                  <rect
                    x={j * cellSize}
                    y={i * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={color.fill}
                    fillOpacity={color.opacity}
                    stroke="var(--border)"
                    strokeWidth={0.5}
                  />
                  {!isDiagonal && (
                    <text
                      x={j * cellSize + cellSize / 2}
                      y={i * cellSize + cellSize / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={textColor}
                      style={{ fontSize: "11px", fontVariantNumeric: "tabular-nums" }}
                    >
                      {value.toFixed(2)}
                    </text>
                  )}
                  {isDiagonal && (
                    <text
                      x={j * cellSize + cellSize / 2}
                      y={i * cellSize + cellSize / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={textColor}
                      style={{ fontSize: "11px" }}
                    >
                      —
                    </text>
                  )}
                </g>
              );
            })
          )}
        </g>

        {/* 图例（颜色条） */}
        <g transform={`translate(${labelWidth}, ${labelHeight + n * cellSize + 12})`}>
          <text x={0} y={0} className="fill-ink-500" style={{ fontSize: "11px" }} dominantBaseline="middle">
            -1
          </text>
          <defs>
            <linearGradient id="heatmap-legend" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.95} />
              <stop offset="50%" stopColor="transparent" />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.95} />
            </linearGradient>
          </defs>
          <rect x={12} y={-6} width={120} height={12} fill="url(#heatmap-legend)" stroke="var(--border)" strokeWidth={0.5} />
          <text x={140} y={0} className="fill-ink-500" style={{ fontSize: "11px" }} dominantBaseline="middle">
            +1
          </text>
          <text x={60} y={18} textAnchor="middle" className="fill-ink-400" style={{ fontSize: "10px" }}>
            相关系数 r
          </text>
        </g>
      </svg>

      {/* Hover tooltip */}
      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-border bg-card px-3 py-1.5 text-caption shadow-sm">
          <span className="font-medium text-ink-900">{dimensions[hover.row]}</span>
          <span className="mx-1 text-ink-400">↔</span>
          <span className="font-medium text-ink-900">{dimensions[hover.col]}</span>
          <span className="ml-2 tabular text-ink-600">r = {hover.value.toFixed(3)}</span>
        </div>
      )}
    </div>
  );
}
