"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { StepNav } from "@/components/layout/step-nav";
import { Watermark } from "@/components/common/watermark";
import { ErrorState } from "@/components/common/error-state";
import { ExportFormatSelector, type ExportFormat } from "@/components/export/export-format-selector";
import { DataPreview } from "@/components/export/data-preview";
import { DownloadButton } from "@/components/export/download-button";
import { WatermarkNotice } from "@/components/export/watermark-notice";
import { useSimulation, useExportDataset } from "@/lib/hooks/use-simulation";
import { toast } from "@/components/ui/toaster";

export default function ExportPage({ params }: { params: { id: string } }) {
  const { data: simulationData, isLoading, isError, error } = useSimulation(params.id);
  const exportMutation = useExportDataset();
  const [exportFormat, setExportFormat] = useState<ExportFormat>("excel");

  const handleDownload = () => {
    exportMutation.mutate(params.id, {
      onSuccess: ({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || `dataset.${exportFormat === "excel" ? "xlsx" : "csv"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("数据导出成功，请检查浏览器下载列表");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "导出失败，请重试");
      },
    });
  };

  if (isLoading) {
    return (
      <div>
        <StepNav projectId={params.id} current="export" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <StepNav projectId={params.id} current="export" />
        <ErrorState
          title="加载数据失败"
          message={error?.message || "无法获取模拟数据，请稍后重试"}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // 检查是否有模拟数据
  const hasSimulationData = (simulationData?.matrix?.cells?.length ?? 0) > 0;

  if (!hasSimulationData) {
    return (
      <div>
        <StepNav projectId={params.id} current="export" />
        <Card className="mt-6 p-8 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-ink-400" />
          <h3 className="text-h3 font-semibold text-ink-900">暂无模拟数据</h3>
          <p className="mt-1 text-body text-ink-500">
            请先完成数据预演，生成模拟数据后再导出。
          </p>
          <Button className="mt-4" asChild>
            <Link href={`/projects/${params.id}/simulate`}>前往数据预演</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href={`/projects/${params.id}`}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          返回工作台
        </Link>
      </Button>

      <StepNav projectId={params.id} current="export" />

      <PageHeader
        title="数据导出"
        description="导出模拟数据集，含 simulated 水印元数据。仅用于研究预演。"
      />

      <Watermark className="mb-4" />

      <div className="space-y-6">
        <ExportFormatSelector value={exportFormat} onChange={setExportFormat} />
        <DataPreview matrix={simulationData!.matrix} />
        <WatermarkNotice />
        <DownloadButton
          format={exportFormat}
          isPending={exportMutation.isPending}
          onDownload={handleDownload}
        />
      </div>
    </div>
  );
}
