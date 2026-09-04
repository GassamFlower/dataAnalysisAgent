"use client";

import Link from "next/link";
import {
  Database,
  FlaskConical,
  FileQuestion,
  Layers,
  RotateCcw,
  Users,
  FileText,
  BarChart3,
  ArrowRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project } from "@/types";

/** ISO 时间 → 中文短日期（如 "2026/7/10"） */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

interface OverviewCardProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function OverviewCard({ title, icon: Icon, children }: OverviewCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-h3 font-semibold text-ink-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface StatProps {
  value: React.ReactNode;
  label: string;
}

function Stat({ value, label }: StatProps) {
  return (
    <div className="rounded-lg bg-cream-surface p-4">
      <p className="text-h2 font-semibold text-ink-900">{value}</p>
      <p className="mt-1 text-caption text-ink-500">{label}</p>
    </div>
  );
}

interface ProjectOverviewProps {
  project: Project;
}

/**
 * 项目概览区。
 * 展示项目模式、题目统计、最新数据集、最新报告摘要，帮助用户快速掌握项目状态。
 */
export function ProjectOverview({ project }: ProjectOverviewProps) {
  const overview = project.overview;
  const isReal = project.mode === "real";

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-h2 font-semibold text-ink-900">项目概览</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 项目模式 */}
        <OverviewCard
          title="项目模式"
          icon={isReal ? Database : FlaskConical}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={isReal ? "default" : "secondary"} className="text-small">
                {isReal ? "真实数据项目" : "模拟预演项目"}
              </Badge>
            </div>
            <p className="text-body text-ink-700">
              {isReal
                ? "基于真实回收的问卷数据进行统计分析与报告生成。"
                : "通过模拟数据预演统计趋势，验证研究假设可行性。"}
            </p>
          </div>
        </OverviewCard>

        {/* 题目统计 */}
        <OverviewCard title="题目统计" icon={FileQuestion}>
          <div className="grid grid-cols-3 gap-3">
            <Stat value={overview?.questionCount ?? 0} label="题目数" />
            <Stat value={overview?.dimensionCount ?? 0} label="维度数" />
            <Stat value={overview?.reverseCount ?? 0} label="反向题" />
          </div>
        </OverviewCard>

        {/* 数据准备 */}
        <OverviewCard title="数据准备" icon={isReal ? Users : Layers}>
          {overview?.dataset?.source ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={isReal ? "default" : "secondary"} className="text-small">
                  {overview.dataset.source === "real" ? "真实回收数据" : "模拟生成数据"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  value={overview.dataset.sampleSize ?? "—"}
                  label="样本量"
                />
                <Stat
                  value={formatDate(overview.dataset.importedAt)}
                  label="导入时间"
                />
              </div>
              {project.status === "inspected" && (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`/projects/${project.id}/simulate`}>
                    重新导入 / 生成数据
                    <RotateCcw className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-body text-ink-500">
                {isReal
                  ? "尚未导入真实回收数据，请先下载模板并上传。"
                  : "尚未生成模拟数据，输入假设后即可生成。"}
              </p>
              <Button size="sm" asChild className="w-full">
                <Link href={`/projects/${project.id}/simulate`}>
                  {isReal ? "导入真实数据" : "去数据预演"}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </OverviewCard>

        {/* 报告产出 */}
        <OverviewCard title="报告产出" icon={FileText}>
          {overview?.report?.hasReport ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="success" className="text-small">
                  已生成报告
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  value={
                    overview.report.overallAlpha != null
                      ? overview.report.overallAlpha.toFixed(3)
                      : "—"
                  }
                  label="平均 Cronbach's α"
                />
                <Stat
                  value={`${overview.report.passedCount ?? 0}/${overview.report.totalCount ?? 0}`}
                  label="达标维度"
                />
              </div>
              <p className="text-caption text-ink-400">
                生成于 {formatDate(overview.report.generatedAt)}
              </p>
              <Button size="sm" asChild className="w-full">
                <Link href={`/projects/${project.id}/report`}>
                  查看报告
                  <BarChart3 className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-body text-ink-500">
                完成数据准备后，即可生成统计报告与智能诊断。
              </p>
              <Button size="sm" variant="outline" asChild className="w-full">
                <Link href={`/projects/${project.id}/simulate`}>
                  先准备数据
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </OverviewCard>
      </div>
    </section>
  );
}
