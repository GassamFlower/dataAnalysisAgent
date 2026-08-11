"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface RelatedArticle {
  slug: string;
  title: string;
  category: string;
  summary?: string | null;
  content_markdown: string;
}

interface RelatedArticlesProps {
  /** 当前文章 slug（用于排除） */
  currentSlug: string;
  /** 相关文章列表 */
  articles: RelatedArticle[];
  /** 分类标签映射 */
  categoryLabel: string;
}

/**
 * 相关文章推荐组件。
 *
 * 在教程详情页底部展示同分类的其他文章，引导用户继续学习。
 */
export function RelatedArticles({
  currentSlug,
  articles,
  categoryLabel,
}: RelatedArticlesProps) {
  const related = articles.filter((a) => a.slug !== currentSlug).slice(0, 3);

  if (!related.length) return null;

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ink-900">
          相关文章 · {categoryLabel}
        </h3>
        <Link
          href="/learn"
          className="flex items-center text-sm text-primary hover:underline"
        >
          查看全部
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {related.map((article) => (
          <Link key={article.slug} href={`/learn/${article.slug}`}>
            <Card className="group h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary">{categoryLabel}</Badge>
                <span className="flex items-center text-xs text-muted-foreground">
                  <Clock className="mr-1 h-3 w-3" />
                  {estimateReadTime(article.content_markdown)}
                </span>
              </div>
              <h4 className="mb-1 line-clamp-2 font-medium text-ink-900 group-hover:text-primary">
                {article.title}
              </h4>
              {article.summary && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {article.summary}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** 估算阅读时长（按中文 300 字/分钟） */
function estimateReadTime(content: string): string {
  const charCount = content.length;
  const minutes = Math.max(1, Math.ceil(charCount / 300));
  return `${minutes} 分钟`;
}