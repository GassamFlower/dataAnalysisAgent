"use client";

import { Card } from "@/components/ui/card";
import type { DiffTestResult } from "@/types";

/**
 * 差异检验效应量图（纯 SVG 水平柱状图，零依赖）。
 * 每条假设路径一根柱，长度 = 效应量，颜色区分显著/不显著。
 * 标注效应量值 + p 值 + 检验方法，直观展示假设验证结果。
 */
export function EffectSizeChart({ results }: { results: DiffTestResult[] | null }) {
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

  const maxEffect = Math.max(1.0, ...valid.map((r) => Math.abs(r.effectSize!)));
  const effectSizeName = valid[0]?.effectSizeName || "r";
  const barAreaW = 320;
  const rowH = 56;
  const labelH = 20;
  const padL = 10;
  const padR = 100; // 右侧标注区
  const W = padL + 200 + barAreaW + padR; // 200 = 路径标签区
  const H = 10 + valid.length * rowH + 10;

  const truncate = (s: string, n: number) =>
    s.length > n ? s.slice(0, n) + "…" : s;

  const formatP = (p: number | null | undefined) => {
    if (p == null) return "—";
    if (p < 0.001) return "p<0.001";
    return `p=${p.toFixed(3)}`;
  };

  return (
    <Card className="p-5">
      {/* 图例 */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-caption text-ink-600">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--chart-1)" }}
          />
          显著（p&lt;0.05）
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--ink-400)" }}
          />
          不显著
        </span>
        <span className="text-ink-400">
          虚线 = 小/中/大效应量阈值（{effectSizeName}）
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: H }}
        role="img"
        aria-label="假设检验效应量柱状图"
      >
        {valid.map((r, i) => {
          const y = 10 + i * rowH;
          const barY = y + labelH;
          const barH = 20;
          const effect = Math.abs(r.effectSize!);
          const barW = (effect / maxEffect) * barAreaW;
          const significant = r.significant ?? (r.pValue != null && r.pValue < 0.05);
          const fillColor = significant ? "var(--chart-1)" : "var(--ink-400)";
          const pathLabel = `${truncate(r.predictor, 8)} → ${truncate(r.outcome, 8)}`;

          // 效应量阈值虚线（0.2/0.4/0.6 for r-like, 或 0.1/0.3/0.5）
          const thresholds = [0.2, 0.4, 0.6];

          return (
            <g key={i}>
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
                const tx = padL + 200 + (t / maxEffect) * barAreaW;
                if (tx > padL + 200 + barAreaW) return null;
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
                x={padL + 200}
                y={barY}
                width={Math.max(barW, 2)}
                height={barH}
                rx={3}
                fill={fillColor}
                opacity={0.85}
              >
                <title>
                  {`${r.predictor} → ${r.outcome}\n` +
                    `方法：${r.methodName || r.method || "—"}\n` +
                    `效应量：${r.effectSizeName || ""} = ${r.effectSize!.toFixed(3)}\n` +
                    `${formatP(r.pValue)}\n` +
                    `${significant ? "显著" : "不显著"}`}
                </title>
              </rect>

              {/* 效应量值 */}
              <text
                x={padL + 200 + Math.max(barW, 2) + 6}
                y={barY + 14}
                className="fill-ink-700"
                style={{ fontSize: 11 }}
              >
                {r.effectSizeName || "r"}={r.effectSize!.toFixed(2)}
              </text>

              {/* p 值 + 显著性标记 */}
              <text
                x={padL + 200 + barAreaW + 10}
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
    </Card>
  );
}
