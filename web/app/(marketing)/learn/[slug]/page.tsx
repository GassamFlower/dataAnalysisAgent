"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Calculator, Clock, TextT } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { MarkdownRenderer } from "@/components/tutorial/MarkdownRenderer";
import { TableOfContents } from "@/components/tutorial/TableOfContents";
import { LearningPath } from "@/components/tutorial/LearningPath";
import { RelatedArticles } from "@/components/tutorial/RelatedArticles";
import { useTutorialArticle, useTutorialArticles } from "@/lib/hooks/use-tutorial";
import { cn } from "@/lib/utils";

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

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级",
};

const DIFFICULTY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  beginner: "secondary",
  intermediate: "outline",
  advanced: "default",
};

const FONT_SIZES = [
  { value: "sm", label: "小", className: "prose-sm" },
  { value: "base", label: "中", className: "prose-base" },
  { value: "lg", label: "大", className: "prose-lg" },
] as const;

type FontSize = (typeof FONT_SIZES)[number]["value"];

/**
 * 教程详情页（公开访问，无需登录）。
 *
 * 根据 slug 渲染单篇 Markdown 教程内容。
 * 支持目录导航、字体大小调节、上一篇/下一篇导航、学习路径、相关文章推荐。
 */
export default function TutorialDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const { data: article, isLoading, isError, error } = useTutorialArticle(params.slug);
  const [fontSize, setFontSize] = useState<FontSize>("base");

  // 加载同分类文章列表，用于计算上一篇/下一篇
  const { data: listData } = useTutorialArticles({
    category: article?.category,
    page: 1,
    page_size: 50,
  });

  // 计算上一篇/下一篇
  const { prevArticle, nextArticle } = (() => {
    if (!article || !listData?.items) return { prevArticle: null, nextArticle: null };
    const items = listData.items;
    const currentIndex = items.findIndex((a) => a.slug === article.slug);
    if (currentIndex === -1) return { prevArticle: null, nextArticle: null };
    return {
      prevArticle: currentIndex > 0 ? items[currentIndex - 1] : null,
      nextArticle: currentIndex < items.length - 1 ? items[currentIndex + 1] : null,
    };
  })();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MarketingHeader />
        <div className="container mx-auto max-w-4xl p-6">
          <LoadingState label="正在加载教程..." />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <MarketingHeader />
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
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <MarketingHeader />
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
      </div>
    );
  }

  const currentFontClass = FONT_SIZES.find((f) => f.value === fontSize)?.className ?? "prose-base";

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <div className="container mx-auto max-w-6xl p-6">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link href="/learn">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回教程列表
          </Link>
        </Button>

        <div className="flex gap-8">
          {/* 主内容区 */}
          <div className="min-w-0 flex-1">
            {/* 文章头部 */}
            <div className="mb-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                {article.difficulty && DIFFICULTY_LABELS[article.difficulty] && (
                  <Badge variant={DIFFICULTY_VARIANTS[article.difficulty] ?? "secondary"}>
                    {DIFFICULTY_LABELS[article.difficulty]}
                  </Badge>
                )}
                <Badge variant={CATEGORY_VARIANTS[article.category] ?? "secondary"}>
                  {CATEGORY_LABELS[article.category] ?? article.category}
                </Badge>
                <span className="flex items-center text-sm text-muted-foreground">
                  <Clock className="mr-1 h-4 w-4" />
                  {estimateReadTime(article.content_markdown)}
                </span>

                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {article.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-ink-500"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* 字体大小调节 */}
                <div className="ml-auto flex items-center gap-1">
                  <TextT className="mr-1 h-4 w-4 text-muted-foreground" />
                  {FONT_SIZES.map((f) => (
                    <Button
                      key={f.value}
                      variant={fontSize === f.value ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setFontSize(f.value)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>

              <h1 className="text-3xl font-bold text-ink-900 sm:text-4xl">
                {article.title}
              </h1>

              {article.summary && (
                <p className="mt-4 text-lg text-muted-foreground">{article.summary}</p>
              )}

              {article.slug === "sample-size-power" && (
                <div className="mt-4">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/learn/tools/sample-size">
                      <Calculator className="mr-1.5 h-4 w-4" />
                      用样本量计算器快速估算
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* 移动端学习路径（桌面端在侧边栏展示） */}
            <div className="mb-8 lg:hidden">
              <LearningPath
                currentSlug={article.slug}
                category={article.category}
                categoryLabel={CATEGORY_LABELS[article.category] ?? article.category}
                articles={listData?.items ?? []}
              />
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
            <Card className={cn("p-6 sm:p-10", currentFontClass)}>
              <MarkdownRenderer content={article.content_markdown} />
            </Card>

            {/* 上一篇 / 下一篇导航 */}
            {(prevArticle || nextArticle) && (
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {prevArticle ? (
                  <Link href={`/learn/${prevArticle.slug}`}>
                    <Card className="group h-full p-4 transition-all hover:shadow-md">
                      <span className="flex items-center text-xs text-muted-foreground">
                        <ArrowLeft className="mr-1 h-3 w-3" />
                        上一篇
                      </span>
                      <p className="mt-2 font-medium text-ink-900 group-hover:text-primary">
                        {prevArticle.title}
                      </p>
                    </Card>
                  </Link>
                ) : (
                  <div />
                )}
                {nextArticle ? (
                  <Link href={`/learn/${nextArticle.slug}`}>
                    <Card className="group h-full p-4 text-right transition-all hover:shadow-md">
                      <span className="flex items-center justify-end text-xs text-muted-foreground">
                        下一篇
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </span>
                      <p className="mt-2 font-medium text-ink-900 group-hover:text-primary">
                        {nextArticle.title}
                      </p>
                    </Card>
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            )}

            {/* 相关文章推荐 */}
            <RelatedArticles
              currentSlug={article.slug}
              categoryLabel={CATEGORY_LABELS[article.category] ?? article.category}
              articles={listData?.items ?? []}
            />
          </div>

          {/* 侧边目录（桌面端 sticky） */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-6 space-y-6">
              <TableOfContents content={article.content_markdown} />
              <LearningPath
                currentSlug={article.slug}
                category={article.category}
                categoryLabel={CATEGORY_LABELS[article.category] ?? article.category}
                articles={listData?.items ?? []}
              />
            </div>
          </aside>
        </div>
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