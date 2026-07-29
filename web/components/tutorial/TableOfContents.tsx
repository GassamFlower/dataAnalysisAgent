"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

interface TableOfContentsProps {
  /** Markdown 原始内容，从中提取 h2/h3 标题 */
  content: string;
  className?: string;
}

/**
 * 从 Markdown 内容中提取 h2/h3 标题，生成侧边目录。
 *
 * 支持滚动监听高亮当前章节，点击跳转。
 */
export function TableOfContents({ content, className }: TableOfContentsProps) {
  const items = useMemo(() => extractHeadings(content), [content]);
  const [activeId, setActiveId] = useState<string>("");

  // 滚动监听：高亮当前可见章节
  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav className={cn("space-y-1", className)} aria-label="目录">
      <p className="mb-3 text-sm font-semibold text-ink-900">目录</p>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
          }}
          className={cn(
            "block rounded px-2 py-1 text-sm transition-colors",
            item.level === 3 && "ml-3",
            activeId === item.id
              ? "bg-primary/10 font-medium text-primary"
              : "text-ink-500 hover:text-ink-900 hover:bg-muted/50"
          )}
        >
          {item.text}
        </a>
      ))}
    </nav>
  );
}

/** 从 Markdown 原文提取 h2/h3 标题 */
function extractHeadings(content: string): TocItem[] {
  const lines = content.split("\n");
  const items: TocItem[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);

    if (h2Match) {
      const text = h2Match[1].trim();
      items.push({ id: toSlug(text), text, level: 2 });
    } else if (h3Match) {
      const text = h3Match[1].trim();
      items.push({ id: toSlug(text), text, level: 3 });
    }
  }

  return items;
}

/** 生成与 MarkdownRenderer toHeadingId 一致的锚点 id */
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
