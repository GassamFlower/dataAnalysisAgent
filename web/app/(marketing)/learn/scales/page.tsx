"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, BookOpen, Loader2, Sparkles, Library } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useScales } from "@/lib/hooks/use-scales";
import { useCreateProject } from "@/lib/hooks/use-project";
import { toast } from "@/components/ui/toaster";
import { SCALE_DISCIPLINES, type ScaleListItem } from "@/types";
import { cn } from "@/lib/utils";

const DISCIPLINE_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline"
> = {
  management: "default",
  education: "secondary",
  psychology: "outline",
};

export default function ScalesLibraryPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [keyword, setKeyword] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [query, setQuery] = useState({ keyword: "", discipline: "" });

  const { data, isLoading, isError, error } = useScales({
    keyword: query.keyword || undefined,
    discipline: query.discipline || undefined,
    page: 1,
    page_size: 24,
  });

  // 建项目弹窗
  const createProject = useCreateProject();
  const [selectedScale, setSelectedScale] = useState<ScaleListItem | null>(
    null
  );
  const [projectName, setProjectName] = useState("");

  const applyFilters = () => {
    setQuery({ keyword: keyword.trim(), discipline });
  };

  const handleUseScale = (scale: ScaleListItem) => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent("/learn/scales")}`);
      return;
    }
    setSelectedScale(scale);
    setProjectName(scale.name);
  };

  const handleConfirmCreate = async () => {
    if (!selectedScale) return;
    if (!projectName.trim()) {
      toast.warning("请输入项目名称");
      return;
    }
    try {
      const project = await createProject.mutateAsync({
        name: projectName.trim(),
        scale_id: selectedScale.id,
      });
      toast.success("项目创建成功，题目已就绪，可直接进入预演");
      setSelectedScale(null);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "创建失败，请重试"
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          title="学科量表库"
          description="管理学 / 教育学 / 心理学常用量表，一键建项目并进入预演，无需手工录题"
        />

        {/* 搜索 + 学科筛选 */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                placeholder="搜索量表名称或简介..."
                className="pl-9"
              />
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
              {[{ value: "", label: "全部" }, ...SCALE_DISCIPLINES].map(
                (opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setDiscipline(opt.value);
                      setQuery((q) => ({ ...q, discipline: opt.value }));
                    }}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs transition-colors",
                      discipline === opt.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ),
              )}
            </div>
            <Button variant="outline" size="sm" onClick={applyFilters}>
              搜索
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            共 {data?.total ?? 0} 个量表
          </p>
        </div>

        {/* 量表卡片区 */}
        {isLoading ? (
          <LoadingState label="正在加载量表..." />
        ) : isError ? (
          <ErrorState
            title="加载失败"
            message={error?.message || "无法获取量表库，请稍后重试"}
            onRetry={() => window.location.reload()}
          />
        ) : !data || data.items.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">未找到量表</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              换一个关键词或学科试试
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((scale) => (
              <Card
                key={scale.id}
                className="flex h-full flex-col transition-shadow hover:shadow-md"
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug text-ink-900">
                      {scale.name}
                    </h3>
                    <Badge
                      variant={
                        DISCIPLINE_VARIANTS[scale.discipline] ?? "secondary"
                      }
                      className="shrink-0"
                    >
                      {SCALE_DISCIPLINES.find(
                        (d) => d.value === scale.discipline,
                      )?.label ?? scale.discipline}
                    </Badge>
                  </div>

                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {scale.description || "暂无简介"}
                  </p>

                  {/* 来源与信效度引用（出处展示） */}
                  <div className="mt-auto space-y-1.5 border-t border-border pt-3">
                    {scale.source && (
                      <p className="line-clamp-2 text-xs text-ink-500">
                        <span className="font-medium text-ink-700">出处：</span>
                        {scale.source}
                      </p>
                    )}
                    {scale.reliabilityRef && (
                      <p className="line-clamp-2 text-xs text-ink-500">
                        <span className="font-medium text-ink-700">信度：</span>
                        {scale.reliabilityRef}
                      </p>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleUseScale(scale)}
                      disabled={createProject.isPending}
                    >
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      用它建项目
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 建项目弹窗 */}
      <Dialog
        open={!!selectedScale}
        onOpenChange={(open) => {
          if (!open) setSelectedScale(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-4 w-4 text-primary" />
              用量表创建项目
            </DialogTitle>
            <DialogDescription>
              题目将自动从所选量表中生成，创建后可直接进入假设与预演。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="scale-project-name">项目名称</Label>
            <Input
              id="scale-project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="输入项目名称"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedScale(null)}
              disabled={createProject.isPending}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmCreate}
              disabled={createProject.isPending}
            >
              {createProject.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                "创建项目"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}