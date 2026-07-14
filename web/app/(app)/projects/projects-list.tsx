"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, FolderOpen, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/ui/toaster";
import { useProjects, useDeleteProject } from "@/lib/hooks/use-project";
import { PROJECT_STATUS, type ProjectStatus } from "@/lib/constants";
import type { Project } from "@/types";

/** 状态 → Badge variant（与 ProjectStatusCard 保持一致） */
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

/** 状态筛选选项 */
const FILTER_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "draft", label: "待体检" },
  { value: "inspected", label: "已体检" },
  { value: "hypothesized", label: "已假设" },
  { value: "simulated", label: "已预演" },
  { value: "analyzed", label: "已出报告" },
] as const;

function ProjectCard({
  project,
  onDelete,
  deleting,
}: {
  project: Project;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const config = PROJECT_STATUS[project.status];
  const variant = STATUS_TO_VARIANT[project.status] ?? "secondary";
  const questionCount = project.structure?.questions?.length ?? 0;
  const dimensionCount = project.structure?.dimensions?.length ?? 0;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    setDeleteOpen(false);
    onDelete(project.id);
  };

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="group relative p-5 transition-colors hover:border-primary/50 hover:bg-cream-surface">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-h3 font-semibold text-ink-900 group-hover:text-primary">
              {project.name}
            </h3>
            <p className="mt-1 text-caption text-ink-500">
              更新于 {new Date(project.updatedAt).toLocaleDateString("zh-CN")}
            </p>
            <div className="mt-3 flex items-center gap-3 text-small text-ink-600">
              <span>{questionCount} 道题目</span>
              {dimensionCount > 0 ? (
                <span>· {dimensionCount} 个维度</span>
              ) : null}
            </div>
          </div>
          <Badge variant={variant} className="shrink-0">
            {config.label}
          </Badge>
        </div>
        {/* 删除按钮（hover 显示） */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={handleDeleteClick}
          aria-label="删除项目"
          disabled={deleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        {/* 删除确认对话框 */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除项目？</DialogTitle>
              <DialogDescription>
                即将删除「{project.name}」，此操作不可撤销，项目数据将永久丢失。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">取消</Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                确认删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </Link>
  );
}

export function ProjectsList() {
  const { data, isLoading, isError, error, refetch } = useProjects();
  const deleteMutation = useDeleteProject();
  const projects = data?.projects ?? [];

  // 搜索 + 筛选状态
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 过滤 + 排序（默认按更新时间降序 = 最近更新优先）
  const filteredProjects = useMemo(() => {
    let result = projects;
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(term));
    }
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    return [...result].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [projects, searchTerm, statusFilter]);

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("项目已删除");
      },
      onError: () => {
        toast.error("删除失败，请重试");
      },
    });
  };

  if (isLoading) {
    return <LoadingState label="正在加载项目列表..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="加载失败"
        message={error?.message || "无法获取项目列表，请稍后重试"}
        onRetry={() => refetch()}
      />
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="还没有项目"
        description="新建一个项目，上传问卷题目开始免费体检。"
        action={
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-1.5 h-4 w-4" />
              创建第一个项目
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 搜索 + 筛选工具栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索项目名称..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 项目列表 */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          title="未找到匹配的项目"
          description={
            searchTerm
              ? `没有名称包含「${searchTerm}」的项目`
              : "当前筛选条件下无项目"
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={handleDelete}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
