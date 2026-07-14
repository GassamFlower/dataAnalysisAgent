"use client";

import Link from "next/link";
import { ArrowRight, Clock, RefreshCw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PROJECT_STATUS, type ProjectStatus } from "@/lib/constants";
import type { Project } from "@/types";

/** 状态 → Badge variant 映射（每个状态独立颜色，区分清晰） */
const STATUS_TO_VARIANT: Record<
  ProjectStatus,
  "secondary" | "default" | "warning" | "success"
> = {
  draft: "secondary",
  inspected: "default",
  hypothesized: "default",
  simulated: "warning",
  analyzed: "success",
};

/** 状态 → 阶段说明文案 */
function getStageDescription(status: ProjectStatus): string {
  switch (status) {
    case "draft":
      return "项目已创建，请上传题目文本进行体检";
    case "inspected":
      return "题目体检完成，可开始数据预演";
    case "hypothesized":
      return "假设已提交，可生成模拟数据";
    case "simulated":
      return "模拟数据已生成，可产出统计报告";
    case "analyzed":
      return "报告已生成，可导出 Word/Excel 或重新预演";
    default:
      return "";
  }
}

/** 状态 → 下一步快捷操作（null 表示无跳转按钮） */
function getNextAction(
  status: ProjectStatus,
  projectId: string
): { label: string; href: string } | null {
  switch (status) {
    case "draft":
      return null;
    case "inspected":
      return { label: "去数据预演", href: `/projects/${projectId}/simulate` };
    case "hypothesized":
      return { label: "去数据预演", href: `/projects/${projectId}/simulate` };
    case "simulated":
      return { label: "去查看报告", href: `/projects/${projectId}/report` };
    case "analyzed":
      return { label: "查看报告", href: `/projects/${projectId}/report` };
    default:
      return null;
  }
}

/** ISO 时间 → 中文长日期（如 "2026年7月10日"） */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * 项目状态总览卡片。
 * 展示当前状态徽章 + 阶段说明 + 创建/更新时间 + 下一步快捷入口。
 * 用于工作台详情页顶部，让用户一眼看到项目进度与下一步。
 */
export function ProjectStatusCard({ project }: { project: Project }) {
  const config = PROJECT_STATUS[project.status];
  const variant = STATUS_TO_VARIANT[project.status] ?? "secondary";
  const nextAction = getNextAction(project.status, project.id);

  return (
    <Card className="mb-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant={variant}>{config.label}</Badge>
            <span className="text-caption text-ink-400">当前阶段</span>
          </div>
          <p className="mt-2 text-body text-ink-600">
            {getStageDescription(project.status)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              创建于 {formatDate(project.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              更新于 {formatDate(project.updatedAt)}
            </span>
          </div>
        </div>
        {nextAction ? (
          <Button asChild className="shrink-0">
            <Link href={nextAction.href}>
              {nextAction.label}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
