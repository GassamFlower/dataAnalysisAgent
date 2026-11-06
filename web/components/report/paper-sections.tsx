"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  Loader2,
  Copy,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { ToneCheck } from "@/components/report/tone-check";
import { usePolishReport } from "@/lib/hooks/use-report";
import type { PolishTone } from "@/lib/hooks/use-report";
import { cn } from "@/lib/utils";

type PaperSection = "method" | "result" | "discussion";

const PAPER_SECTIONS: { value: PaperSection; label: string; desc: string }[] = [
  { value: "method", label: "研究方法", desc: "量表维度 / 统计检验 / 样本规模" },
  { value: "result", label: "研究结果", desc: "Cronbach α / 差异检验 P 值 / 预演命中率" },
  { value: "discussion", label: "讨论", desc: "对已算数字的规范化解读，不下结论" },
];

export function PaperSections({ reportId }: { reportId: string }) {
  const [section, setSection] = useState<PaperSection>("result");
  const [cache, setCache] = useState<
    Record<PaperSection, { text: string; tone: PolishTone | null }>
  >({
    method: { text: "", tone: null },
    result: { text: "", tone: null },
    discussion: { text: "", tone: null },
  });
  const polishMutation = usePolishReport();

  const text = cache[section].text;
  const tone = cache[section].tone;
  const activeDesc = PAPER_SECTIONS.find((s) => s.value === section)?.desc ?? "";
  const activeLabel = PAPER_SECTIONS.find((s) => s.value === section)?.label ?? "";

  const handleGenerate = useCallback(async () => {
    try {
      const result = await polishMutation.mutateAsync({ reportId, section });
      setCache((prev) => ({
        ...prev,
        [section]: { text: result.text, tone: result.tone ?? null },
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成失败，请重试");
    }
  }, [reportId, section, polishMutation]);

  const handleRefine = useCallback(async () => {
    if (!text) return;
    try {
      const result = await polishMutation.mutateAsync({
        reportId,
        section,
        currentText: text,
      });
      setCache((prev) => ({
        ...prev,
        [section]: { text: result.text, tone: result.tone ?? null },
      }));
      toast.success("已按表达体检项改写");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "再润色失败，请重试");
    }
  }, [reportId, section, text, polishMutation]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PAPER_SECTIONS.map((s) => (
          <Button
            key={s.value}
            type="button"
            variant={section === s.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSection(s.value)}
          >
            {s.label}
            {cache[s.value].text && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-60" />
            )}
          </Button>
        ))}
        <span className="ml-auto" />
        <Button
          type="button"
          size="sm"
          onClick={handleGenerate}
          disabled={polishMutation.isPending}
        >
          {polishMutation.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-1.5 h-4 w-4" />
          )}
          {text ? `重新生成${activeLabel}` : `生成${activeLabel}`}段落
        </Button>
      </div>

      <p className="text-caption text-ink-500">
        {activeDesc}
      </p>

      {/* 首次生成：空状态 + loading */}
      {polishMutation.isPending && !text && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-14 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-body text-ink-700">正在生成，预计 10-30 秒…</p>
        </div>
      )}

      {/* 已有文本（含重新生成时旧文本 + 遮罩） */}
      {text && (
        <div className="space-y-3">
          <div className="relative rounded-md border border-border bg-cream-surface/50 p-4">
            <p className={cn(
              "whitespace-pre-wrap text-body leading-relaxed text-ink-700",
              polishMutation.isPending && "opacity-40",
            )}>
              {text}
            </p>
            {polishMutation.isPending && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md">
                <div className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-small text-ink-700">正在重新生成…</span>
                </div>
              </div>
            )}
          </div>
          {tone && (
            <ToneCheck
              tone={tone}
              onRefine={handleRefine}
              refining={polishMutation.isPending}
            />
          )}
          {!polishMutation.isPending && (
            <>
              <div className="flex items-start gap-2 rounded-md bg-muted/30 p-3 text-caption text-ink-500">
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
            </>
          )}
        </div>
      )}

      {/* 空状态：未生成且非 loading */}
      {!polishMutation.isPending && !text && (
        <div className="rounded-md border border-dashed py-10 text-center text-body text-muted-foreground">
          选择章节后点击「生成」按钮，将实际统计输出转为可复制的论文段落
        </div>
      )}
    </div>
  );
}
