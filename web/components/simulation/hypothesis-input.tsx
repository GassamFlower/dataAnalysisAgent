"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * 假设输入（A 体验入口）。
 * 用户一句话描述期望的数据趋势，后端 LLM 解析为主效应路径。
 * 宪法第 12 条：A 体验 + C 底层，路径在矩阵中透明可编辑。
 */
export function HypothesisInput({
  value,
  onChange,
  onParse,
  parsing = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onParse?: () => void;
  parsing?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Label htmlFor="hypothesis">一句话描述你的研究假设</Label>
      <textarea
        id="hypothesis"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="例如：学习动机越强，学业表现越好；自我效能感在其中起中介作用。"
        className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-body text-foreground placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-between">
        <p className="text-caption text-ink-400">
          系统将解析为主效应路径，并在矩阵中透明标注，你可自由编辑。
        </p>
        <Button
          size="sm"
          onClick={onParse}
          disabled={value.trim().length === 0 || parsing}
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          {parsing ? "解析中..." : "解析假设"}
        </Button>
      </div>
    </div>
  );
}
