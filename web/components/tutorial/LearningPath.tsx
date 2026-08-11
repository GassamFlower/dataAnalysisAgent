"use client";

import Link from "next/link";
import { Check, ChevronRight, GraduationCap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface LearningPathArticle {
  slug: string;
  title: string;
  category: string;
  order_index: number;
}

interface LearningPathProps {
  /** 当前文章 slug */
  currentSlug: string;
  /** 当前文章所属分类 */
  category: string;
  /** 分类标签映射 */
  categoryLabel: string;
  /** 同分类全部文章（按 order_index 升序） */
  articles: LearningPathArticle[];
}

/**
 * 学习路径组件。
 *
 * 展示当前文章在所属分类学习路径中的位置，引导用户按顺序系统学习。
 * 当前文章高亮，已完成（排在当前之前）的文章显示勾选标记。
 */
export function LearningPath({
  currentSlug,
  category,
  categoryLabel,
  articles,
}: LearningPathProps) {
  if (!articles.length) return null;

  const currentIndex = articles.findIndex((a) => a.slug === currentSlug);
  const position = currentIndex === -1 ? 0 : currentIndex + 1;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-ink-900">
          {categoryLabel} · 学习路径
        </h3>
        <span className="ml-auto text-xs text-muted-foreground">
          第 {position} / {articles.length} 篇
        </span>
      </div>

      {/* 进度条 */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(position / articles.length) * 100}%` }}
        />
      </div>

      {/* 路径列表 */}
      <ol className="space-y-1">
        {articles.map((article, index) => {
          const isCurrent = article.slug === currentSlug;
          const isCompleted = index < currentIndex;
          return (
            <li key={article.slug}>
              <Link
                href={`/learn/${article.slug}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isCurrent
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-ink-900"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="line-clamp-1 flex-1">{article.title}</span>
                {isCurrent && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}