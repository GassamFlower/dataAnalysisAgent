"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X, Info, Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWjxImport } from "@/lib/hooks/use-questionnaire";
import { toast } from "@/components/ui/toaster";

/**
 * 问卷星导入组件。
 *
 * 引导用户从问卷星后台导出题目文件（Excel/Word）后上传，
 * 系统自动解析题目、选项、维度信息。
 *
 * 设计依据：docs/w-功能-问卷星链接解析.md（方案 C：用户导出 + 解析）
 */
export function WjxImporter({
  projectId,
  onSuccess,
}: {
  projectId: string;
  onSuccess?: (data: {
    questions: unknown[];
    dimensions: string[];
    question_count: number;
    dimension_count: number;
  }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useWjxImport();

  const validateFile = (selectedFile: File): boolean => {
    const ext = selectedFile.name
      .slice(selectedFile.name.lastIndexOf("."))
      .toLowerCase();
    if (![".xlsx", ".xls", ".docx"].includes(ext)) {
      toast.error("仅支持 .xlsx / .xls / .docx 文件");
      return false;
    }
    if (selectedFile.size > 2 * 1024 * 1024) {
      toast.error("文件大小超过 2MB 限制");
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

  const handleImport = async () => {
    if (!file) {
      toast.warning("请先选择问卷星导出的文件");
      return;
    }

    try {
      const data = await importMutation.mutateAsync({
        projectId,
        file,
      });
      toast.success(
        `导入成功，共解析出 ${data.question_count} 道题，${data.dimension_count} 个维度`
      );
      if (data.warnings?.length) {
        toast.warning(`部分行解析失败：${data.warnings.length} 条警告`);
      }
      onSuccess?.(data);
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "问卷星导入失败");
    }
  };

  return (
    <div className="space-y-4">
      {/* 步骤引导 */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="text-body text-ink-700">
              <p className="font-medium text-ink-900">如何从问卷星导入？</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-caption text-ink-500">
                <li>登录问卷星（wjx.cn），进入您的问卷</li>
                <li>点击「设计」→「导出问卷」</li>
                <li>选择「导出题目」，格式选择 Excel（推荐）或 Word</li>
                <li>下载文件后，点击下方区域上传</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 上传区域 */}
      <div className="flex min-h-[180px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-cream-surface/50 px-6 py-8 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.docx"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          disabled={importMutation.isPending}
        />

        {file ? (
          <div className="flex items-center gap-2 text-body text-ink-700">
            <FileText className="h-5 w-5 text-primary" />
            <span className="max-w-[240px] truncate">{file.name}</span>
            <span className="text-caption text-ink-400">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="rounded p-1 hover:bg-cream-surface"
              aria-label="移除文件"
              disabled={importMutation.isPending}
            >
              <X className="h-4 w-4 text-ink-400" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-ink-400" />
            <p className="mt-3 text-body text-ink-700">
              点击或拖拽文件上传
            </p>
          </>
        )}

        <p className="mt-1 text-caption text-ink-400">
          支持 .xlsx / .xls / .docx，单文件 ≤ 2MB
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={importMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? "重新选择" : "选择文件"}
        </Button>
      </div>

      {/* 导入按钮 */}
      <div className="flex justify-end">
        <Button
          onClick={handleImport}
          disabled={!file || importMutation.isPending}
        >
          {importMutation.isPending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              解析中...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              导入问卷星文件
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
