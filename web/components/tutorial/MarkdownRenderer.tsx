"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";

import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Markdown 渲染组件。
 *
 * 用于教程详情页渲染 Markdown 内容，支持：
 * - GitHub Flavored Markdown（表格、删除线、任务列表等）
 * - 代码高亮（highlight.js）
 * - 数学公式（KaTeX，支持 $...$ 行内和 $$...$$ 块级）
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose prose-stone max-w-none",
        "prose-headings:font-semibold prose-headings:text-ink-900",
        "prose-p:text-ink-700 prose-p:leading-relaxed",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-ink-900",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:text-ink-900",
        "prose-pre:rounded-lg prose-pre:bg-muted prose-pre:p-4",
        "prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:pl-4",
        "prose-li:text-ink-700",
        "prose-img:rounded-lg",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-6 mt-8 text-3xl font-bold text-ink-900">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-4 mt-8 text-2xl font-semibold text-ink-900 scroll-mt-20" id={toHeadingId(children)}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-3 mt-6 text-xl font-semibold text-ink-900 scroll-mt-20" id={toHeadingId(children)}>
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-4">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-2 pl-6">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-2 pl-6">{children}</ol>
          ),
          table: ({ children }) => (
            <div className="mb-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-4 py-2.5 text-left font-semibold text-ink-900">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border px-4 py-2 text-ink-700">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** 从标题子节点提取文本，生成 URL 锚点 id（供 TOC 目录跳转） */
function toHeadingId(children: React.ReactNode): string {
  const text = extractText(children);
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** 递归提取 ReactNode 中的纯文本 */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as React.ReactElement).props.children);
  }
  return "";
}
