"use client";

import { useState } from "react";
import { FileSpreadsheet, FileUp, Download, Loader2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PaidActionGuard } from "@/components/common/paid-action-guard";
import { toast } from "@/components/ui/toaster";
import {
  useDownloadTemplate,
  useImportDataset,
} from "@/lib/hooks/use-dataset";
import type { DatasetImportResult, MatchBy, TemplateFormat } from "@/lib/api/dataset";

interface RealDataImporterProps {
  projectId: string;
  userPlan: string;
  onImportSuccess?: (data: DatasetImportResult) => void;
}

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".sav"];

/**
 * 真实回收数据导入组件。
 *
 * 提供模板下载、文件拖拽上传、列名匹配方式选择与导入提交。
 */
export function RealDataImporter({
  projectId,
  userPlan,
  onImportSuccess,
}: RealDataImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [matchBy, setMatchBy] = useState<MatchBy>("text");
  const [isDragging, setIsDragging] = useState(false);

  const downloadMutation = useDownloadTemplate();
  const importMutation = useImportDataset();

  const handleDownloadTemplate = async (format: TemplateFormat) => {
    try {
      const { blob, filename } = await downloadMutation.mutateAsync({
        projectId,
        format,
        matchBy,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `template_${projectId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("模板下载成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "模板下载失败");
    }
  };

  const validateFile = (selectedFile: File): boolean => {
    const ext = selectedFile.name.slice(selectedFile.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error("仅支持 .csv / .xlsx / .sav 文件");
      return false;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("文件大小超过 10MB 限制");
      return false;
    }
    return true;
  };

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    handleFileChange(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleImport = async () => {
    if (!file) {
      toast.warning("请先选择要上传的数据文件");
      return;
    }

    try {
      const data = await importMutation.mutateAsync({
        projectId,
        file,
        matchBy,
      });
      toast.success(`导入成功，共 ${data.row_count} 条数据`);
      onImportSuccess?.(data);
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败，请重试");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-h3 font-semibold text-ink-900">
            1. 下载数据模板
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-body text-ink-500">
            按题目编号或题面文本整理回收数据，确保列名与模板一致。
          </p>

          <div className="space-y-3">
            <Label className="text-body font-medium text-ink-700">
              列名匹配方式
            </Label>
            <RadioGroup
              value={matchBy}
              onValueChange={(value) => setMatchBy(value as MatchBy)}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="text" id="match-text" />
                <Label htmlFor="match-text" className="text-body text-ink-600">
                  按题面文本匹配（推荐）
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="index" id="match-index" />
                <Label htmlFor="match-index" className="text-body text-ink-600">
                  按题目编号匹配（Q1, Q2…）
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => handleDownloadTemplate("csv")}
              disabled={downloadMutation.isPending}
            >
              {downloadMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              下载 CSV 模板
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownloadTemplate("xlsx")}
              disabled={downloadMutation.isPending}
            >
              {downloadMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              )}
              下载 Excel 模板
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-h3 font-semibold text-ink-900">
            2. 上传回收数据
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              flex flex-col items-center justify-center rounded-lg border-2 border-dashed
              px-6 py-10 text-center transition-colors
              ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border bg-cream-surface"
              }
            `}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileUp className="h-6 w-6" />
            </div>
            <p className="mt-4 text-body font-medium text-ink-700">
              拖拽文件到此处，或
              <label className="cursor-pointer text-primary hover:underline">
                点击选择
                <input
                  type="file"
                  accept=".csv,.xlsx,.sav"
                  className="sr-only"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                />
              </label>
            </p>
            <p className="mt-1 text-caption text-ink-400">
              支持 .csv / .xlsx / .sav（SPSS），文件大小不超过 10MB
            </p>
          </div>

          {file && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-body font-medium text-ink-700">
                  {file.name}
                </p>
                <p className="text-caption text-ink-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
              >
                移除
              </Button>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-cream-surface p-3 text-caption text-ink-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p>导入前请确认：</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>样本量不少于 30 条（建议 100 条以上）；</li>
                <li>整体缺失值比例不超过 30%；</li>
                <li>Likert 题使用 1~5 或 1~7 的整数分值。</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end">
            <PaidActionGuard plan={userPlan} actionType="data_import">
              <Button
                size="lg"
                onClick={handleImport}
                disabled={!file || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="mr-1.5 h-4 w-4" />
                )}
                {importMutation.isPending ? "导入中…" : "导入真实数据"}
              </Button>
            </PaidActionGuard>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
