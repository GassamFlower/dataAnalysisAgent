"use client";

import { useMemo, useState } from "react";
import { Flask, Cursor } from "@phosphor-icons/react";

import { Card } from "@/components/ui/card";

/**
 * 落地页可交互预演 demo（Task 5.3）。
 * 拖动「效应量」与「样本量」→ 命中率实时变化，对比竞品「拖拽即得」。
 * 纯前端：命中率用双独立样本 t 检验的功效近似（n 为每组样本量，α=0.05 双侧）。
 *   命中率 ≈ Φ( d·√(n/2) − 1.96 )
 * 移动端用原生 <input type=range>，天然支持触控拖动。
 */
function normalCdf(x: number): number {
  // 标准正态 CDF：Φ(x) = 0.5·(1 + erf(x/√2))，erf 用 Abramowitz & Stegun 7.1.26 近似，误差 < 1.5e-7
  const z = x / Math.SQRT2;
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const t = 1 / (1 + p * Math.abs(z));
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const erfAbs = 1 - poly * Math.exp(-z * z);
  const cdf = z >= 0 ? 0.5 * (1 + erfAbs) : 0.5 * (1 - erfAbs);
  return Math.max(0, Math.min(1, cdf));
}

/** 命中率：0~1 */
function hitRate(effect: number, n: number): number {
  const zScore = effect * Math.sqrt(n / 2) - 1.96;
  return Math.max(0, Math.min(1, normalCdf(zScore)));
}

function hitLabel(p: number): { text: string; color: string } {
  if (p >= 0.8) return { text: "高 · 可放心预演", color: "text-success" };
  if (p >= 0.6) return { text: "中 · 建议加大样本", color: "text-warning" };
  return { text: "低 · 强依赖加大样本", color: "text-error" };
}

export function DemoSimulation() {
  const [effect, setEffect] = useState(0.5);
  const [n, setN] = useState(100);

  const rate = useMemo(() => hitRate(effect, n), [effect, n]);
  const percent = Math.round(rate * 100);
  const { text, color } = hitLabel(rate);

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <Card className="overflow-hidden border border-primary/15">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
          {/* 左：说明 + 控制 */}
          <div className="flex flex-col gap-6 p-7 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Cursor className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink-900">
                  拖一拖，回收前就知道命中率
                </h2>
                <p className="mt-2 text-body text-ink-500">
                  拖动效应量与样本量，实时看这套研究的统计显著性命中率——不用开 SPSS，先验证方向对不对。
                </p>
              </div>
            </div>

            {/* 效应量滑块 */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor="demo-effect" className="text-body font-medium text-ink-700">
                  效应量（Cohen&apos;s d）
                </label>
                <span className="font-mono text-h3 font-semibold text-primary tabular-nums">
                  {effect.toFixed(2)}
                </span>
              </div>
              <input
                id="demo-effect"
                type="range"
                min={0}
                max={0.8}
                step={0.01}
                value={effect}
                onChange={(e) => setEffect(Number(e.target.value))}
                aria-label="效应量"
                className="h-2 w-full cursor-pointer accent-primary"
              />
            </div>

            {/* 样本量滑块 */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor="demo-n" className="text-body font-medium text-ink-700">
                  样本量（每组）
                </label>
                <span className="font-mono text-h3 font-semibold text-primary tabular-nums">
                  {n}
                </span>
              </div>
              <input
                id="demo-n"
                type="range"
                min={20}
                max={400}
                step={5}
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
                aria-label="样本量"
                className="h-2 w-full cursor-pointer accent-primary"
              />
            </div>

            <p className="flex items-start gap-1.5 text-caption text-ink-400">
              <Flask className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              命中率 = 双独立样本 t 检验 ≤ 0.05 的功效近似；真实预演按你的题目与假设计算。
            </p>
          </div>

          {/* 右：命中率展示 */}
          <div className="flex flex-col items-center justify-center gap-4 border-t border-border bg-cream-surface p-8 lg:border-l lg:border-t-0">
            <div
              className="flex h-32 w-32 items-center justify-center rounded-full border-[6px]"
              style={{
                borderColor: "var(--primary)",
                background: `conic-gradient(var(--primary) ${percent}%, var(--border) ${percent}% 100%)`,
              }}
            >
              <div className="flex h-[calc(128px-38px)] w-[calc(128px-38px)] items-center justify-center rounded-full bg-card">
                <span className="font-mono text-2xl font-bold text-ink-900 tabular-nums">
                  {percent}%
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className={`font-display text-h3 font-semibold ${color}`}>{text}</p>
              <p className="mt-1 text-caption text-ink-500">
                以 {effect.toFixed(2)} 的效应量 × 每组 {n} 人估算
              </p>
            </div>
            <p className="text-center text-caption text-ink-400">
              {rate >= 0.8
                ? "命中率已达 80% 一线，方向大概率可行。"
                : `当前命中率未到 80%，加大样本量或提高效应量即可翻盘。`}
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
}