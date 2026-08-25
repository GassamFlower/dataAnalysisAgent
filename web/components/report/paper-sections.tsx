"use client";

import { useState } from "react";
import {
  FileText,
  Loader2,
  Copy,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { usePolishReport, type PolishSection } from "@/lib/hooks/use-report";
import { cn } from "@/lib/utils";

/**
 * 论文段落生成（Task 3.1 / R6 扩展）。
 *
 * 方法 / 结果 / 讨论 单选，一键生成对齐实际统计输出（Cronbach α、P 值、效应量、
 * 预演命中率）的 APA 段落。仅结果规范化、不代写研究结论；逐 "统计描述参考" 免责。
 */
const PAPER_SECTIONS: { value: PolishSection; label: string; desc: string }[] = [
  { value: "method", label: "研究方法", desc: "量表维度 / 统计检验 / 样本规模" },
  { value: "result", label: "研究结果", desc: "Cronbach α / 差异检验 P 值 / 预演命中率" },
  { value: "discussion", label: "讨论", desc: "对已算数字的规范化解读，不下结论" },
];

export function PaperSections({ reportId }: { reportId: string }) {
  const [section, setSection] = useState<PolishSection>("result");
  const [text, setText] = useState("");
  const polishMutation = usePolishReport();

  const handleGenerate = async () => {
    setText("");
    try {
      const result = await polishMutation.mutateAsync({ reportId, section });
      setText(result.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成失败，请重试");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  };

  const activeLabel =
    PAPER_SECTIONS.find((s) => s.value === section)?.label ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PAPER_SECTIONS.map((s) => (
          <Button
            key={s.value}
            type="button"
            variant={section === s.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSection(s.value);
              setText("");
            }}
          >
            {s.label}
          </Button>
        ))}
        <span className="ml-auto" />
        <Button
          type="button"
          size="sm"
          onClick={handleGenerate}
          disabled={polishMutation.isPending}
        >
          {polishMutation.isPending && !text ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-1.5 h-4 w-4" />
          )}
          生成{activeLabel}段落
        </Button>
      </div>
      <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {PAPER_SECTIONS.map((s) => (
          <span
            key={s.value}
            className={cn(section === s.value && "font-medium text-foreground")}
          >
            · {s.label}：{s.desc}
          </span>
        ))}
      </p>

      {polishMutation.isPending && !text && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-14 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm text-ink-600">正在生成，预计 10-30 秒…</p>
        </div>
      )}

      {text && !polishMutation.isPending && (
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-cream-surface/50 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
              {text}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/30 p-3 text-xs text-ink-500">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
            <span>
              此为统计描述参考，非研究结论。已自动规避结论性措辞；请结合您的实际研究背景审慎使用。
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerate}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              重新生成
            </Button>
            <Button type="button" size="sm" onClick={handleCopy}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              一键复制
            </Button>
          </div>
        </div>
      )}

      {!polishMutation.isPending && !text && (
        <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          选择章节后点击「生成」按钮，将实际统计输出转为可复制的论文段落
        </div>
      )}
    </div>
  );
}