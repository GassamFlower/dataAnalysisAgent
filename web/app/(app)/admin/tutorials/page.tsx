"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { toast } from "@/components/ui/toaster";
import {
  useDeleteTutorialArticle,
  useTutorialArticles,
} from "@/lib/hooks/use-tutorial";
import type { TutorialArticleListItem } from "@/lib/api/tutorial";

/** 分类标签映射 */
const CATEGORY_LABELS: Record<string, string> = {
  basics: "统计基础",
  methods: "分析方法",
  writing: "论文写作",
};

/** 分类对应的徽章样式 */
const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  basics: "default",
  methods: "secondary",
  writing: "outline",
};

/**
 * 管理员教程列表页。
 *
 * 展示所有教程（含未发布），支持新建、编辑、删除。
 * 后端会根据用户 token 自动返回未发布教程，故前端直接请求列表。
 */
export default function AdminTutorialsPage() {
  const { data, isLoading, isError, error, refetch } = useTutorialArticles({
    page: 1,
    page_size: 50, // 后端 tutorials 端点 page_size 上限为 50（超过返回 42200）
  });
  const deleteArticle = useDeleteTutorialArticle();

  const [pendingDelete, setPendingDelete] =
    useState<TutorialArticleListItem | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteArticle.mutateAsync(pendingDelete.id);
      toast.success("已删除教程");
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败，请重试");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="教程管理"
        description="管理统计小课堂的教程文章，包括新建、编辑与删除。"
        actions={
          <Button asChild>
            <Link href="/admin/tutorials/new">
              <Plus className="mr-1.5 h-4 w-4" />
              新建教程
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState label="正在加载教程..." />
      ) : isError ? (
        <ErrorState
          title="加载失败"
          message={error?.message || "无法获取教程列表，请稍后重试"}
          onRetry={() => refetch()}
        />
      ) : !data?.items.length ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold text-ink-900">暂无教程</h3>
          <p className="mt-1 text-sm text-ink-500">
            点击右上角“新建教程”开始创建第一篇内容
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>分类</TableHead>
                <TableHead className="w-20">排序</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead className="w-32 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <div className="font-medium text-ink-900">
                      {article.title}
                    </div>
                    <div className="text-caption text-ink-400">
                      /learn/{article.slug}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={CATEGORY_VARIANTS[article.category] ?? "secondary"}
                    >
                      {CATEGORY_LABELS[article.category] ?? article.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-ink-700">
                    {article.order_index}
                  </TableCell>
                  <TableCell>
                    {article.is_published ? (
                      <Badge variant="success">已发布</Badge>
                    ) : (
                      <Badge variant="outline">草稿</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label="编辑"
                      >
                        <Link
                          href={`/admin/tutorials/${article.slug}/edit`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="删除"
                        onClick={() => setPendingDelete(article)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 删除二次确认 */}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除教程「{pendingDelete?.title}」吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleteArticle.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteArticle.isPending}
            >
              {deleteArticle.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
