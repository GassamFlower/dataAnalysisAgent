"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Target,
  FileBarChart,
  ChartNoAxesCombined,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stagger, StaggerItem } from "@/components/motion/reveal";

/**
 * M2 首页「报告预览」区 —— 让外行在回收前看到"要交的成品长什么样"。
 *
 * 用真实的示例指标（α/KMO/p 值）排版成沉浸式报告预览，而非靠文字解释。
 * 全部为静态示例数据，仅作视觉示范。
 */

const SAMPLE_METRICS = [
  { label: "总量表 Cronbach's α", value: "0.91", tone: "text-success" },
  { label: "KMO 抽样适合度", value: "0.82", tone: "text-success" },
  { label: "Bartlett 球形检验", value: "p<0.001", tone: "text-success" },
  { label: "维度 1 α", value: "0.86", tone: "text-success" },
  { label: "维度 2 α", value: "0.79", tone: "text-warning" },
  { label: "假设检验差异", value: "p<0.05", tone: "text-success" },
];

export function ReportPreview() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <Stagger step={0.09} className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
        <StaggerItem>
          <div>
            <h2 className="text-h2 font-semibold text-ink-900">
              你要交的论文那几页，回收前就先看到成品
            </h2>
            <p className="mt-3 text-body-lg text-ink-500">
              不用等收完几百份问卷、答辩前才发现信效度翻车。上传题目即可生成示例报告，
              提前看懂 α、KMO、t 检验这些答辩必问的数字到底长什么样、达不达标。
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-caption text-ink-500">
              {["Cronbach's α 信度", "KMO + Bartlett 效度", "t / F / χ² 检验", "样本代表性诊断"].map(
                (tag) => (
                  <span key={tag} className="flex items-center gap-1.5">
                    <BadgeCheck className="h-3.5 w-3.5 text-success" />
                    {tag}
                  </span>
                )
              )}
            </div>
            <Button size="lg" className="mt-6" asChild>
              <Link href="/projects/new">
                免费做一次体检
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </StaggerItem>

        {/* 右侧：沉浸式示例报告卡片 */}
        <StaggerItem>
          <Card className="relative overflow-hidden border-border bg-cream-surface p-6 shadow-md">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileBarChart className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-caption font-medium text-ink-700">信效度检验 · 预演报告</div>
                <div className="text-caption text-ink-400">示例数据 · 仅作展示</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {SAMPLE_METRICS.map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-border bg-card p-3 text-left"
                >
                  <div className="text-caption text-ink-400">{m.label}</div>
                  <div className={`mt-1 font-display text-2xl font-bold ${m.tone}`}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2.5">
              <Target className="h-4 w-4 shrink-0 text-success" />
              <p className="text-caption text-ink-700">
                样本代表性诊断：结构分布达标，可按当前计划回收。
              </p>
            </div>

            <div className="relative mt-4 overflow-hidden rounded-md bg-cream-surface p-4">
              <ChartNoAxesCombined className="mb-2 h-8 w-8 text-ink-400" />
              <div className="flex h-24 items-end gap-2">
                {[72, 88, 64, 95, 80, 69, 91].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-ink-400/70"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

            <p className="mt-3 text-caption text-ink-400">
              ↑ 差异分析柱状图示例 · 生成报告时自动产出
            </p>
          </Card>
        </StaggerItem>
      </Stagger>
    </section>
  );
}