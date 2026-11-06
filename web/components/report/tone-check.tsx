"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PolishTone } from "@/lib/hooks/use-report";
import { cn } from "@/lib/utils";

/**
 * 润色结果的「表达体检」摘要。
 * 检测为确定性规则（不调用模型）；再润色为可选手动操作，会消耗一次润色额度。
 */
export function ToneCheck({
  tone,
  onRefine,
  refining = false,
  disabled = false,
}: {
  tone: PolishTone;
  onRefine?: () => void;
  refining?: boolean;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = tone.items;
  const shown = expanded ? items : items.slice(0, 3);
  const delta =
    typeof tone.previous_actionable === "number" &&
    tone.previous_actionable !== tone.actionable;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-small font-medium text-ink-700">表达体检</span>
        {tone.actionable > 0 ? (
          <span className="rounded-full border tone-warning-surface px-2 py-0.5 text-caption">
            {tone.actionable} 处可改 · {tone.kinds} 类
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-caption text-primary">
            <CheckCircle2 className="h-3 w-3" />
            未发现可改项
          </span>
        )}
        {delta ? (
          <span className="text-caption text-ink-400">
            再润色后 {tone.previous_actionable} → {tone.actionable} 处
          </span>
        ) : null}
        <span className="ml-auto text-caption text-ink-400">
          确定性规则检测，不消耗模型调用
        </span>
      </div>

      {tone.actionable > 0 ? (
        <>
          <ul className="mt-2 space-y-1.5">
            {shown.map((item) => (
              <li key={item.id} className="text-caption text-ink-500">
                <span className="text-ink-700">{item.name}</span>
                <span className="text-ink-400"> · {item.count} 处</span>
                {item.examples.length > 0 ? (
                  <span className="ml-1">例：「{item.examples[0]}」</span>
                ) : null}
              </li>
            ))}
            {tone.fingerprints.map((item) => (
              <li key={item.key} className="text-caption text-ink-500">
                <span className="text-ink-700">{item.label}</span>
                <span className="text-ink-400"> · {item.density}/千字</span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {items.length > 3 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-caption"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "收起" : `查看全部 ${tone.kinds} 类`}
                <ChevronDown
                  className={cn(
                    "ml-1 h-3 w-3 transition-transform",
                    expanded && "rotate-180"
                  )}
                />
              </Button>
            ) : null}
            {onRefine ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-caption"
                onClick={onRefine}
                disabled={refining || disabled}
              >
                {refining ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3 w-3" />
                )}
                按体检项再润色
              </Button>
            ) : null}
            <span className="text-caption text-ink-400">
              再润色会重新调用一次 AI，消耗 1 次润色额度
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
