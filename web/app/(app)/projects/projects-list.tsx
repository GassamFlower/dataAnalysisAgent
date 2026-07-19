"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FolderOpen,
  Search,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  useProjects,
  useDeleteProject,
  useUpdateProject,
} from "@/lib/hooks/use-project";
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
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const updateMutation = useUpdateProject();

  const handleCardClick = () => {
    if (deleting) return;
    router.push(`/projects/${project.id}`);
  };

  const config = PROJECT_STATUS[project.status];
  const variant = STATUS_TO_VARIANT[project.status] ?? "secondary";
  const questionCount = project.structure?.questions?.length ?? 0;
  const dimensionCount = project.structure?.dimensions?.length ?? 0;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteOpen(true);
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRenameValue(project.name);
    setRenameOpen(true);
  };

  const handleConfirmDelete = () => {
    setDeleteOpen(false);
    onDelete(project.id);
  };

  const handleConfirmRename = () => {
    const name = renameValue.trim();
    if (!name || name === project.name) {
      setRenameOpen(false);
      return;
    }
    updateMutation.mutate(
      { projectId: project.id, name },
      {
        onSuccess: () => {
          setRenameOpen(false);
          toast.success("项目名称已更新");
        },
        onError: () => {
          toast.error("重命名失败，请重试");
        },
      }
    );
  };

  return (
    <Card
      className="group relative cursor-pointer p-5 transition-colors hover:border-primary/50 hover:bg-cream-surface"
      onClick={handleCardClick}
    >
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
      {/* 操作按钮（hover 显示） */}
      <div className="absolute right-2 top-2 flex opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleRenameClick}
          aria-label="重命名项目"
          disabled={updateMutation.isPending}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleDeleteClick}
          aria-label="删除项目"
          disabled={deleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {/* 删除确认对话框 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除项目？</DialogTitle>
            <DialogDescription>
              即将删除「{project.name}」，删除后项目不会出现在列表中。
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
      {/* 重命名对话框 */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
            <DialogDescription>
              修改后点击保存，项目所有关联数据保持不变。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor={`rename-${project.id}`}>项目名称</Label>
            <Input
              id={`rename-${project.id}`}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="请输入项目名称"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmRename();
              }}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              onClick={handleConfirmRename}
              disabled={
                updateMutation.isPending ||
                !renameValue.trim() ||
                renameValue.trim() === project.name
              }
            >
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const PAGE_SIZE = 8;

export function ProjectsList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useProjects({
    page,
    pageSize: PAGE_SIZE,
  });
  const deleteMutation = useDeleteProject();
  const projects = useMemo(() => data?.projects ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 搜索 + 筛选状态
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 搜索/筛选变化时回到第一页
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

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
        // 删除成功后显式回到项目列表，避免旧 Link 事件或异常状态留在已删除项目页
        router.push("/projects");
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

  if (total === 0) {
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
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="搜索项目名称..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
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

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-caption text-ink-500">
            共 {total} 条 · {page}/{totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              下一页
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
