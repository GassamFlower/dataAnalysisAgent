"use client";

import { useState } from "react";
import { Sparkles, Loader2, Copy, Check, AlertCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/tutorial/MarkdownRenderer";
import {
  useAIInterpret,
  useAIInterpretQuota,
} from "@/lib/hooks/use-tutorial";
import { toast } from "@/components/ui/toaster";

interface AIInterpretButtonProps {
  projectId: string;
  section?: "reliability" | "correlation" | "diff_test" | "overall";
}

/**
 * AI 解读按钮 + 结果展示组件。
 *
 * 用户点击后调用 LLM 生成通俗解读与论文写作建议，
 * 支持：自定义提问、板块选择、一键复制、额度提示。
 */
export function AIInterpretButton({
  projectId,
  section = "overall",
}: AIInterpretButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [copied, setCopied] = useState(false);

  const quotaQuery = useAIInterpretQuota();
  const interpretMutation = useAIInterpret(projectId);

  const remaining = quotaQuery.data?.remaining;
  const isExhausted = remaining === 0;
  const result = interpretMutation.data;

  const handleInterpret = async () => {
    try {
      await interpretMutation.mutateAsync({
        question: question.trim() || undefined,
        section,
      });
      setIsOpen(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "AI 解读生成失败，请稍后重试";
      toast.error(message);
    }
  };

  const handleCopy = async () => {
    if (!result?.content) return;
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  };

  return (
    <div className="space-y-3">
      {/* 触发按钮 */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleInterpret}
          disabled={
            interpretMutation.isPending ||
            isExhausted ||
            quotaQuery.isLoading
          }
        >
          {interpretMutation.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-4 w-4" />
          )}
          AI 帮我解读
        </Button>

        {/* 额度提示 */}
        {quotaQuery.data && (
          <Badge variant={isExhausted ? "destructive" : "secondary"}>
            {isExhausted ? "本周额度已用完" : `本周剩余 ${remaining} 次`}
          </Badge>
        )}
      </div>

      {/* 自定义提问输入框 */}
      <div className="flex gap-2">
        <textarea
          placeholder="可选：输入你想问的问题（如“α 系数偏低怎么办”）"
          value={question}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setQuestion(e.target.value)
          }
          className="flex min-h-[44px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          maxLength={500}
        />
      </div>

      {/* 结果展示 */}
      {isOpen && result && (
        <Card className="border-primary/30 bg-cream-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI 解读结果
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7"
              >
                {copied ? (
                  <Check className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-1 h-3.5 w-3.5" />
                )}
                {copied ? "已复制" : "复制"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-7"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {result.question && (
              <div className="mb-3 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
                <span className="font-medium">你的提问：</span>
                {result.question}
              </div>
            )}
            <MarkdownRenderer content={result.content} />
            <div className="mt-4 border-t border-border pt-2 text-xs text-muted-foreground">
              剩余额度：{result.quota_remaining} 次 / 本周
            </div>
          </CardContent>
        </Card>
      )}

      {/* 错误提示 */}
      {interpretMutation.isError && !isOpen && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {interpretMutation.error?.message || "AI 解读生成失败"}
          </span>
        </div>
      )}
    </div>
  );
}
