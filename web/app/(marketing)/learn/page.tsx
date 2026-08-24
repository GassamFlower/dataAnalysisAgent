"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Calculator, Clock, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { useTutorialArticles } from "@/lib/hooks/use-tutorial";

const CATEGORIES = [
  { value: "all", label: "全部" },
  { value: "basics", label: "统计基础" },
  { value: "methods", label: "分析方法" },
  { value: "writing", label: "论文写作" },
];

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

const DIFFICULTY_OPTIONS = [
  { value: "", label: "全部难度" },
  { value: "beginner", label: "入门" },
  { value: "intermediate", label: "进阶" },
  { value: "advanced", label: "高级" },
];

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

/**
 * 统计知识小课堂列表页（公开访问，无需登录）。
 *
 * 展示所有已发布的教程文章，支持分类筛选、标签筛选、难度筛选和关键词搜索。
 * 未登录用户可直接浏览，登录后可通过顶部导航进入项目功能。
 */
export default function LearnPage() {
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [tag, setTag] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const { data, isLoading, isError, error } = useTutorialArticles({
    category: category === "all" ? undefined : category,
    tag: tag || undefined,
    difficulty: difficulty || undefined,
    keyword: keyword || undefined,
    page: 1,
    page_size: 24,
  });

  // 从当前加载的文章聚合出现的标签，供快速筛选
  const allTags = Array.from(
    new Set((data?.items ?? []).flatMap((a) => a.tags ?? [])),
  ).slice(0, 12);

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <div className="container mx-auto max-w-6xl space-y-8 p-6">
        <PageHeader
          title="统计知识小课堂"
          description="从统计基础到论文写作，系统学习问卷研究必备知识"
        />

        {/* 工具入口 */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/learn/tools/sample-size"
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10"
          >
            <Calculator className="h-4 w-4" />
            样本量计算器（免费工具）
          </Link>
        </div>

        {/* 筛选与搜索 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={category}
            onValueChange={setCategory}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-4 sm:w-auto">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.value} value={c.value}>
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索教程标题或摘要..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* 标签 + 难度筛选 */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(tag === t ? "" : t)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  tag === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-cream-surface/50 text-ink-600 hover:border-primary/40"
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <span>难度：</span>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDifficulty(opt.value)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  difficulty === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-ink-600 hover:bg-muted-foreground/10"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 内容区 */}
        {isLoading ? (
          <LoadingState label="正在加载教程..." />
        ) : isError ? (
          <ErrorState
            title="加载失败"
            message={error?.message || "无法获取教程列表，请稍后重试"}
            onRetry={() => window.location.reload()}
          />
        ) : data?.items.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">暂无教程</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              当前筛选条件下没有找到教程，换个关键词试试
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data?.items.map((article) => (
              <Link key={article.id} href={`/learn/${article.slug}`}>
                <Card className="group h-full overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg">
                  {/* 封面图 */}
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    {article.cover_image ? (
                      <img
                        src={article.cover_image}
                        alt={article.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                        <BookOpen className="h-12 w-12 text-primary/40" />
                      </div>
                    )}
                  </div>

                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      {article.difficulty &&
                        DIFFICULTY_LABELS[article.difficulty] && (
                          <Badge
                            variant={
                              DIFFICULTY_VARIANTS[article.difficulty] ??
                              "secondary"
                            }
                          >
                            {DIFFICULTY_LABELS[article.difficulty]}
                          </Badge>
                        )}
                      <Badge variant={CATEGORY_VARIANTS[article.category] ?? "secondary"}>
                        {CATEGORY_LABELS[article.category] ?? article.category}
                      </Badge>
                      <span className="flex items-center text-xs text-muted-foreground">
                        <Clock className="mr-1 h-3 w-3" />
                        {estimateReadTime(article.content_markdown)}
                      </span>
                    </div>

                    <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-ink-900 transition-colors group-hover:text-primary">
                      {article.title}
                    </h3>

                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {article.summary || "暂无摘要"}
                    </p>

                    {article.tags && article.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {article.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-ink-500"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* 加载更多（简单分页提示） */}
        {data && data.total > data.items.length && (
          <div className="text-center">
            <Button variant="outline" disabled>
              已展示 {data.items.length} / {data.total} 篇教程
            </Button>
          </div>
        )}
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