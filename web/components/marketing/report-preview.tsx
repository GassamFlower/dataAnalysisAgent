"use client";

import Link from "next/link";
import { SealCheck, ArrowRight, ShieldCheck } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/report/stat-card";
import { ReliabilityChart } from "@/components/report/reliability-chart";
import { ReliabilityTable } from "@/components/report/reliability-table";
import { DiagnosisAlert } from "@/components/report/diagnosis-alert";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import type { ReliabilityResult, Diagnosis } from "@/types";

/**
 * M2 首页「报告预览」区。
 * 复用真实报告组件（StatCard / ReliabilityChart / ReliabilityTable / DiagnosisAlert），
 * 用一套合理论文示例数据排版成"你要交的报告"高保真样张 —— 与正式报告同一套视觉语言。
 * 顶部醒目标注"示例数据 · 仅作展示"，诚实合规不误导。
 */

// 真实报告同款数据结构（示例值，仅作展示）
const SAMPLE_RELIABILITY: ReliabilityResult[] = [
  {
    dimension: "工作满意度",
    alpha: 0.912,
    kmo: 0.861,
    bartlettPValue: 0.0001,
    passed: true,
    alphaGrade: "优秀",
    kmoGrade: "良好",
  },
  {
    dimension: "组织认同",
    alpha: 0.846,
    kmo: 0.793,
    bartlettPValue: 0.0001,
    passed: true,
    alphaGrade: "良好",
    kmoGrade: "可接受",
  },
  {
    dimension: "工作压力",
    alpha: 0.624,
    kmo: 0.582,
    bartlettPValue: 0.0001,
    passed: false,
    alphaGrade: "不足",
    kmoGrade: "可接受",
  },
];

const SAMPLE_DIAGNOSIS: Diagnosis = {
  passed: false,
  issues: [
    {
      dimension: "工作压力",
      metric: "Cronbach's α",
      value: 0.624,
      threshold: 0.7,
      reason: "该维度 α 低于 0.70，可能因题项表述歧义或包含反向题未反转导致内部一致性不足。",
      oneLiner:
        "把「工作压力」两道方向相反的题统一为同向，或删除与总分相关性低于 0.3 的题目后再测一次。",
      suggestion: "检查反向题的计分是否已反转，并复核题项文字是否有歧义。",
    },
  ],
};

const TOTAL_ALPHA = 0.793;

export function ReportPreview() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      {/* 标题 + 诚实标识 */}
      <Stagger step={0.1} className="text-center">
        <StaggerItem>
          <Badge variant="outline" className="mb-3 px-3 py-1 font-normal text-ink-500">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            示例数字 · 仅作为展示
          </Badge>
        </StaggerItem>
        <StaggerItem>
          <h2 className="text-h2 font-semibold text-ink-900">
            你要交的论文「数据部分」，回收前就先看到
          </h2>
        </StaggerItem>
        <StaggerItem>
          <p className="mx-auto mt-3 max-w-2xl text-body-lg text-ink-500">
            上传题目即可生成这份预演报告。不用等收完几百份问卷、答辩前才发现信效度翻车——
            提前看懂 α、KMO、t 检验这些答辩必问的数字长什么样、卡在哪。
          </p>
        </StaggerItem>
      </Stagger>

      {/* 高保真报告样张（复用真实报告组件） */}
      <Stagger step={0.08} className="mt-10 space-y-6">
        {/* 总体概览 */}
        <StaggerItem>
          <Card className="border-border bg-cream-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-h3 font-semibold text-ink-900">总体概览</h3>
              <span className="text-caption text-ink-400">预演报告 · 示例</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="平均 Cronbach's α"
                value={TOTAL_ALPHA}
                threshold="≥ 0.700"
                passed={TOTAL_ALPHA >= 0.7}
              />
              <StatCard
                label="达标维度"
                value="2/3"
                threshold="全部达标"
                passed={false}
              />
              <StatCard
                label="建议样本量"
                value={172}
                threshold="≥ 172"
                passed={true}
              />
            </div>
          </Card>
        </StaggerItem>

        {/* 各维度信效度 */}
        <StaggerItem>
          <Card className="border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-4 text-h3 font-semibold text-ink-900">各维度信效度</h3>
            <div className="mb-6">
              <ReliabilityChart results={SAMPLE_RELIABILITY} />
            </div>
            <ReliabilityTable results={SAMPLE_RELIABILITY} />
          </Card>
        </StaggerItem>

        {/* 智能诊断：抓出问题并给一句话建议 */}
        <StaggerItem>
          <div className="rounded-xl border border-border bg-cream-surface p-5">
            <h3 className="mb-3 text-h3 font-semibold text-ink-900">智能诊断</h3>
            <DiagnosisAlert diagnosis={SAMPLE_DIAGNOSIS} />
            <p className="mt-3 text-caption text-ink-500">
              这里展示了一个不达标维度（α 0.624）——正是因为回收前就能发现，写论文结论前就能改，不用等到答辩。
            </p>
          </div>
        </StaggerItem>
      </Stagger>

      {/* 底部引导 */}
      <Stagger className="mt-10 text-center">
        <StaggerItem>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/projects/new">
                免费上传题目，生成你的报告
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/pricing">联系客服</Link>
            </Button>
          </div>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-caption text-ink-400">
            <span className="flex items-center gap-1.5">
              <SealCheck className="h-3.5 w-3.5 text-success" />
              体检永久免费
            </span>
            <span className="flex items-center gap-1.5">
              <SealCheck className="h-3.5 w-3.5 text-success" />
              示例数据仅作结构展示
            </span>
            <span className="flex items-center gap-1.5">
              <SealCheck className="h-3.5 w-3.5 text-success" />
              合规路线 · 仅用于研究预演
            </span>
          </p>
        </StaggerItem>
      </Stagger>
    </section>
  );
}

export default ReportPreview;