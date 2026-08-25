"use client";

import { useState } from "react";
import { Sparkles, Loader2, Copy, RefreshCw, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { usePolishReport } from "@/lib/hooks/use-report";
import type { Report } from "@/types";

/**
 * 报告文字润色按钮（R6）。
 *
 * 点击后调用 LLM 将指定章节的统计结果转化为论文段落。
 * 严格边界控制：输出仅"统计描述参考"，不生成"研究结论"。
 *
 * 设计依据：docs/u-功能-报告文字润色.md
 */
export function PolishButton({
  reportId,
  section,
  report,
}: {
  reportId: string;
  section: "reliability" | "correlation" | "diff_test" | "diagnosis";
  report?: Report;
}) {
  const [open, setOpen] = useState(false);
  const [polishText, setPolishText] = useState<string>("");
  const polishMutation = usePolishReport();

  const sectionLabels: Record<typeof section, string> = {
    reliability: "信效度分析",
    correlation: "相关分析",
    diff_test: "差异检验",
    diagnosis: "智能诊断",
  };

  const handlePolish = async () => {
    setOpen(true);
    setPolishText("");
    try {
      const result = await polishMutation.mutateAsync({
        reportId,
        section,
      });
      setPolishText(result.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "润色失败，请重试");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(polishText);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handlePolish}
        disabled={polishMutation.isPending || !report}
      >
        {polishMutation.isPending && open ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-1.5 h-4 w-4" />
        )}
        AI 润色
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {sectionLabels[section]} - AI 润色
            </DialogTitle>
            <DialogDescription>
              基于本章节统计结果生成的论文段落参考，可复制到论文中使用
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[420px] overflow-y-auto">
            {polishMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-body text-ink-600">
                  AI 润色中，预计 10-30 秒...
                </p>
                <p className="mt-1 text-caption text-ink-400">
                  正在调用大模型生成论文段落
                </p>
              </div>
            ) : polishText ? (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-cream-surface/50 p-4">
                  <p className="whitespace-pre-wrap text-body leading-relaxed text-ink-800">
                    {polishText}
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-md bg-muted/30 p-3 text-caption text-ink-500">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                  <span>
                    此为统计描述参考，非研究结论。请结合您的实际研究背景审慎使用。
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-body text-ink-500">
                润色失败，请关闭后重试
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <span className="text-caption text-ink-400">
              免责声明：统计描述参考，非研究结论
            </span>
            <div className="flex gap-2">
              {polishText && !polishMutation.isPending && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePolish}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    重新生成
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopy}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    一键复制
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
