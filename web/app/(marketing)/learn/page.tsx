"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Calculator, Clock, FlaskConical, Lightbulb, Library, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { TermCard } from "@/components/tutorial/TermCard";
import { tutorialApi, type TermCardResponse } from "@/lib/api/tutorial";
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

  // 语义搜索：命中统计术语时，在结果上方给出术语卡片
  const [searchTerm, setSearchTerm] = useState<TermCardResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const kw = keyword.trim();
    if (!kw) {
      setSearchTerm(null);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await tutorialApi.searchTutorial(kw);
        setSearchTerm(res.term);
      } catch {
        setSearchTerm(null);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

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

        {/* 预演微课 · 引导卡片 */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-cream-surface/60 to-cream-surface px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-ink-900">
                  预演微课 · 发问卷前，先模拟一遍
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  回收后再改已太晚——先用"预演"验证量表与假设，发布前发现问题。
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button size="sm" variant="default" asChild>
                <Link href="/learn/pre-simulation-why">
                  <BookOpen className="mr-1.5 h-4 w-4" />
                  开始学习 · 为何先预演
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/projects/new">
                  <FlaskConical className="mr-1.5 h-4 w-4" />
                  直接进入预演
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* 学科量表库 · 入口 */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-cream-surface/60 to-cream-surface px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Library className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-ink-900">学科量表库</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  管理学 / 教育学 / 心理学常用量表，一键建项目并进入预演，免去手工录题。
                </p>
              </div>
            </div>
            <Button size="sm" variant="default" className="shrink-0" asChild>
              <Link href="/learn/scales">
                <Library className="mr-1.5 h-4 w-4" />
                浏览量表库
              </Link>
            </Button>
          </div>
        </div>

        {/* 免费工具入口 + 搜索（一行） */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calculator className="h-4 w-4" />
              免费工具：样本量计算器
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              · 共 {data?.total ?? 0} 篇
            </span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜教程或术语，如「信度」「效应量」..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* 分类 + 难度（一行） */}
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="grid w-auto grid-cols-4">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.value} value={c.value}>
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <span className="text-xs text-muted-foreground">难度</span>
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDifficulty(opt.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  difficulty === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 标签（横向滑动） */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs text-muted-foreground">标签</span>
            <div className="flex gap-1.5">
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(tag === t ? "" : t)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
                    tag === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-ink-600 hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 语义搜索：术语卡片（命中术语时显示在结果上方） */}
        {searchLoading ? (
          <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            正在解析关键词…
          </div>
        ) : searchTerm ? (
          <TermCard term={searchTerm} />
        ) : keyword.trim() ? (
          <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            未匹配到术语，以下为标题/摘要命中「{keyword.trim()}」的教程
          </div>
        ) : null}

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