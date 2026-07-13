"use client";

import { Label } from "@/components/ui/label";

/**
 * 样本量输入。建议区间 100~500，本科毕设典型 200 份。
 */
export function SampleSizeInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="sample-size">样本份数</Label>
      <div className="flex items-center gap-3">
        <input
          id="sample-size"
          type="range"
          min={50}
          max={500}
          step={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-cream-muted accent-primary"
        />
        <input
          type="number"
          min={50}
          max={500}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="tabular h-9 w-20 rounded-md border border-input bg-background px-2 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-caption text-ink-400">份</span>
      </div>
      <p className="text-caption text-ink-400">
        建议 200 份左右，过低信度不稳，过高耗时增加。
      </p>
    </div>
  );
}
