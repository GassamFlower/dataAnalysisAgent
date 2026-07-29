"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { useTutorialArticles } from "@/lib/hooks/use-tutorial";
import { cn } from "@/lib/utils";

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

/**
 * 统计知识小课堂列表页。
 *
 * 展示所有已发布的教程文章，支持分类筛选和关键词搜索。
 */
export default function LearnPage() {
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("");

  const { data, isLoading, isError, error } = useTutorialArticles({
    category: category === "all" ? undefined : category,
    keyword: keyword || undefined,
    page: 1,
    page_size: 24,
  });

  return (
    <div className="container mx-auto max-w-6xl space-y-8 p-6">
      <PageHeader
        title="统计知识小课堂"
        description="从统计基础到论文写作，系统学习问卷研究必备知识"
      />

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
  );
}

/** 估算阅读时长（按中文 300 字/分钟） */
function estimateReadTime(content: string): string {
  const charCount = content.length;
  const minutes = Math.max(1, Math.ceil(charCount / 300));
  return `${minutes} 分钟`;
}
