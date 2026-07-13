"use client";

import { Card } from "@/components/ui/card";
import type { CorrelationMatrix } from "@/types";

interface DataPreviewProps {
  matrix: CorrelationMatrix;
}

/**
 * 数据预览表格（前 10 行）
 */
export function DataPreview({ matrix }: DataPreviewProps) {
  const dimensions = matrix.dimensions || [];

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-h2 font-semibold text-ink-900">数据预览</h2>
      <p className="mb-4 text-body text-ink-500">
        以下为模拟数据的前 10 行预览。实际导出包含完整数据集。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-small">
          <thead>
            <tr className="border-b border-border bg-cream-muted/30">
              <th className="px-3 py-2 text-left font-medium text-ink-600">
                样本编号
              </th>
              {dimensions.map((dim) => (
                <th
                  key={dim}
                  className="px-3 py-2 text-left font-medium text-ink-600"
                >
                  {dim}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-border/50">
                <td className="px-3 py-2 text-ink-500">#{rowIdx + 1}</td>
                {dimensions.map((dim) => {
                  // 生成模拟值（实际应从后端获取）
                  const value = Math.floor(Math.random() * 5) + 1;
                  return (
                    <td key={dim} className="px-3 py-2 text-ink-700">
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-caption text-ink-400">
        注：预览数据为随机生成，实际导出数据基于相关矩阵和假设路径计算。
      </p>
    </Card>
  );
}
