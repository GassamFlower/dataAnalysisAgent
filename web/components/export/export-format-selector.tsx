"use client";

import { Card } from "@/components/ui/card";

export type ExportFormat = "excel" | "csv";

interface ExportFormatSelectorProps {
  value: ExportFormat;
  onChange: (format: ExportFormat) => void;
}

/**
 * 导出格式选择器
 */
export function ExportFormatSelector({ value, onChange }: ExportFormatSelectorProps) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-h2 font-semibold text-ink-900">选择导出格式</h2>
      <div className="flex gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="format"
            value="excel"
            checked={value === "excel"}
            onChange={() => onChange("excel")}
            className="h-4 w-4"
          />
          <span className="text-body text-ink-700">Excel (.xlsx)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="format"
            value="csv"
            checked={value === "csv"}
            onChange={() => onChange("csv")}
            className="h-4 w-4"
          />
          <span className="text-body text-ink-700">CSV (.csv)</span>
        </label>
      </div>
    </Card>
  );
}
