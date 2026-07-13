"use client";

import { Card } from "@/components/ui/card";

/**
 * 水印告知组件（宪法第 7 条：水印铁律）
 */
export function WatermarkNotice() {
  return (
    <Card className="p-6">
      <h2 className="mb-3 text-h2 font-semibold text-ink-900">水印告知</h2>
      <p className="text-body text-ink-700">
        导出的数据集将在元数据中标注 <code className="font-mono text-ink-900">SIMULATED</code> 水印，
        表明该数据为研究预演数据，不可直接用于正式研究或论文。
      </p>
      <p className="mt-2 text-caption text-ink-500">
        此措施符合宪法第 7 条&ldquo;水印铁律&rdquo;，确保数据来源透明可追溯。
      </p>
    </Card>
  );
}
