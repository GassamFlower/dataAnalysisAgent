import Link from "next/link";
import { BookOpen, Info } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TermCardResponse } from "@/lib/api/tutorial";

/**
 * 语义搜索术语卡片：搜索词命中统计术语时，在结果上方给出简单释义 + 示例 + 去学链接。
 */
export function TermCard({
  term,
  className,
}: {
  term: TermCardResponse;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="border-l-4 border-primary bg-gradient-to-br from-primary/[0.06] via-cream-surface/70 to-cream-surface p-5">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="text-caption font-medium uppercase tracking-wide text-ink-500">
              术语释义
            </h3>
            <p className="mt-1 text-lg font-semibold text-ink-900">
              {term.title}
            </p>
            <p className="mt-1.5 text-body text-ink-700">{term.content}</p>
            {term.example && (
              <p className="mt-2 rounded-md bg-background/70 px-3 py-2 text-sm text-ink-600">
                <span className="mr-1 font-medium text-primary">示例：</span>
                {term.example}
              </p>
            )}
            {term.learn_more_slug && (
              <Link
                href={`/learn/${term.learn_more_slug}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                <BookOpen className="h-4 w-4" />
                去小课堂系统学习这个概念
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}