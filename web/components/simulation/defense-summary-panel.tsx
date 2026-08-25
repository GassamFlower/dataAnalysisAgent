"use client";

import { Copy, Check, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import type { DefenseSummary } from "@/types";

/** 将命中率分数格式化为百分比（保留整数） */
function fmtPct(value: number): string {
  return `${Math.round(((value ?? 0) * 100))}%`;
}

/** 拼装可复制的纯文本摘要（含逐路径问答） */
function buildCopyText(summary: DefenseSummary): string {
  const lines: string[] = [];
  lines.push(`模拟答辩摘要（样本量 ${summary.sampleSize}，总体命中率 ${fmtPct(summary.overall)}，${summary.passedCount}/${summary.totalCount} 条达标）`);
  lines.push("");
  if (summary.text) lines.push(summary.text);
  lines.push("");
  summary.items.forEach((item, i) => {
    const tag = item.passed ? "达标" : "未达标";
    lines.push(`${i + 1}. ${item.predictor} → ${item.outcome}（命中率 ${fmtPct(item.hitRate)}，${tag}）`);
    lines.push(`   Q：${item.question}`);
    lines.push(`   A：${item.answer}`);
    lines.push("");
  });
  lines.push(`免责声明：${summary.disclaimer}`);
  return lines.join("\n");
}

/** 复制文本到剪贴板（兼容非安全上下文） */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

/**
 * 模拟答辩摘要面板。
 * 逐条假设路径展示“评审可能提问 + 建议回答口径”，仅覆盖统计范式，不代写结论；
 * 未达标路径在回答中提示建议增加样本量。
 */
export function DefenseSummaryPanel({
  summary,
  isLoading,
}: {
  summary: DefenseSummary | null;
  isLoading?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await copyText(buildCopyText(summary));
      setCopied(true);
      toast.success("答辩摘要已复制");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-h3 font-semibold text-ink-900">模拟答辩摘要</h3>
          <p className="mt-1 text-body text-ink-500">
            逐条假设路径的答辩问答，仅覆盖统计范式，帮助预演答辩口径，不代表真实评审结果。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-xl bg-muted px-4 py-2 text-center">
            <div className="text-2xl font-bold leading-tight">
              {summary ? fmtPct(summary.overall) : "—"}
            </div>
            <div className="text-caption">
              {summary
                ? `${summary.passedCount}/${summary.totalCount} 条达标`
                : "暂无数据"}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!summary || isLoading || copied}
          >
            {copied ? (
              <Check className="mr-1.5 h-4 w-4" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" />
            )}
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5 flex items-center justify-center gap-2 py-10 text-body text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在生成答辩摘要...
        </div>
      ) : summary ? (
        <>
          {summary.text && (
            <p className="mt-5 rounded-lg bg-muted/50 p-3 text-body text-ink-700">
              {summary.text}
            </p>
          )}

          <ul className="mt-5 space-y-4">
            {summary.items.map((item) => (
              <li
                key={`${item.predictor}->${item.outcome}`}
                className="rounded-lg border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-body font-medium text-ink-900">
                    {item.predictor}
                    <span className="mx-1 text-ink-400">→</span>
                    {item.outcome}
                    <span className="ml-1.5 text-caption text-ink-400">
                      {item.direction === "negative" ? "-" : "+"}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-caption ${
                      item.passed
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    命中率 {fmtPct(item.hitRate)} · {item.passed ? "达标" : "未达标"}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-body text-ink-700">
                    <span className="font-medium text-ink-900">Q：</span>
                    {item.question}
                  </p>
                  <p className="text-body text-ink-600">
                    <span className="font-medium text-ink-900">A：</span>
                    {item.answer}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 rounded-lg bg-warning/5 p-3 text-caption text-ink-600">
            {summary.disclaimer}
          </p>
        </>
      ) : null}
    </Card>
  );
}