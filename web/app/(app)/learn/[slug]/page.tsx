"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { MarkdownRenderer } from "@/components/tutorial/MarkdownRenderer";
import { useTutorialArticle } from "@/lib/hooks/use-tutorial";

const CATEGORY_LABELS: Record<string, string> = {
  basics: "统计基础",
  methods: "分析方法",
  writing: "论文写作",
};

const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  basics: "default",
  methods: "secondary",
  writing: "outline",
};

/**
 * 教程详情页。
 *
 * 根据 slug 渲染单篇 Markdown 教程内容。
 */
export default function TutorialDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const { data: article, isLoading, isError, error } = useTutorialArticle(params.slug);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <LoadingState label="正在加载教程..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/learn">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回教程列表
          </Link>
        </Button>
        <ErrorState
          title="加载失败"
          message={error?.message || "无法获取教程内容，请稍后重试"}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/learn">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回教程列表
          </Link>
        </Button>
        <Card className="p-12 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">教程不存在</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            该教程可能已被删除或尚未发布
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/learn">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          返回教程列表
        </Link>
      </Button>

      {/* 文章头部 */}
      <div className="mb-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant={CATEGORY_VARIANTS[article.category] ?? "secondary"}>
            {CATEGORY_LABELS[article.category] ?? article.category}
          </Badge>
          <span className="flex items-center text-sm text-muted-foreground">
            <Clock className="mr-1 h-4 w-4" />
            {estimateReadTime(article.content_markdown)}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-ink-900 sm:text-4xl">
          {article.title}
        </h1>

        {article.summary && (
          <p className="mt-4 text-lg text-muted-foreground">{article.summary}</p>
        )}
      </div>

      {/* 封面图 */}
      {article.cover_image && (
        <div className="mb-8 overflow-hidden rounded-xl">
          <img
            src={article.cover_image}
            alt={article.title}
            className="w-full object-cover"
          />
        </div>
      )}

      {/* Markdown 内容 */}
      <Card className="p-6 sm:p-10">
        <MarkdownRenderer content={article.content_markdown} />
      </Card>

      {/* 底部导航 */}
      <div className="mt-8 flex justify-center">
        <Button variant="outline" asChild>
          <Link href="/learn">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回教程列表
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** 估算阅读时长（按中文 300 字/分钟） */
function estimateReadTime(content: string): string {
  const charCount = content.length;
  const minutes = Math.max(1, Math.ceil(charCount / 300));
  return `${minutes} 分钟阅读`;
}
