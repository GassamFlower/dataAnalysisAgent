"use client";

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ExportFormat } from "./export-format-selector";

interface DownloadButtonProps {
  format: ExportFormat;
  isPending: boolean;
  onDownload: () => void;
}

/**
 * 下载按钮
 */
export function DownloadButton({ format, isPending, onDownload }: DownloadButtonProps) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-h2 font-semibold text-ink-900">下载数据集</h2>
      <p className="mb-4 text-body text-ink-500">
        点击按钮下载完整模拟数据集（{format === "excel" ? "Excel" : "CSV"} 格式）。
      </p>
      <Button onClick={onDownload} disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在生成文件...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            下载数据集
          </>
        )}
      </Button>
    </Card>
  );
}
