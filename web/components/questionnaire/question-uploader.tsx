"use client";

import { useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUploadQuestionnaire } from "@/lib/hooks/use-questionnaire";

/**
 * 题目上传组件（受控）。
 * 支持文件上传（.docx/.txt）或粘贴文本两种方式。
 * value/onChange 由父组件控制，便于模板填充。
 */
export function QuestionUploader({
  projectId,
  getProjectId,
  value,
  onChange,
  disabled,
}: {
  projectId?: string;
  getProjectId?: () => Promise<string>;
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"file" | "paste">("paste");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadQuestionnaire();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".txt", ".docx", ".xlsx", ".pdf"].includes(ext)) {
      onChange("");
      setFileName(null);
      // 让父组件通过清空 value 感知错误，实际可扩展为 onError 回调
      alert("仅支持 .docx / .txt / .xlsx / .pdf 文件");
      return;
    }

    setFileName(file.name);
    try {
      let targetProjectId = projectId;
      if (!targetProjectId) {
        if (!getProjectId) {
          throw new Error("缺少项目信息，无法上传文件");
        }
        targetProjectId = await getProjectId();
      }
      const result = await upload.mutateAsync({
        projectId: targetProjectId,
        file,
      });
      onChange(result.text);
    } catch (err) {
      onChange("");
      setFileName(null);
      alert(err instanceof Error ? err.message : "文件上传失败");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function clearFile() {
    setFileName(null);
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "paste" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("paste")}
          disabled={disabled || upload.isPending}
        >
          <FileText className="mr-1.5 h-4 w-4" />
          粘贴文本
        </Button>
        <Button
          type="button"
          variant={mode === "file" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("file")}
          disabled={disabled || upload.isPending}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          上传文档
        </Button>
      </div>

      {mode === "paste" ? (
        <div className="space-y-2">
          <Label htmlFor="raw-text">题目内容</Label>
          <textarea
            id="raw-text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="将问卷题目粘贴于此，每行一道题..."
            disabled={disabled}
            className="min-h-[240px] w-full rounded-md border border-input bg-background px-3 py-2 text-body text-foreground placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      ) : (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-cream-surface/50 px-6 py-10 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx,.xlsx,.pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled || upload.isPending}
          />
          {fileName ? (
            <div className="flex items-center gap-2 text-body text-ink-700">
              <FileText className="h-5 w-5" />
              <span className="max-w-[200px] truncate">{fileName}</span>
              <button
                type="button"
                onClick={clearFile}
                className="rounded p-1 hover:bg-cream-surface"
                aria-label="清除文件"
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
            支持 .docx / .txt / .xlsx / .pdf，单文件 ≤ 2MB
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={disabled || upload.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {upload.isPending ? "上传中..." : fileName ? "重新选择" : "选择文件"}
          </Button>
        </div>
      )}
    </div>
  );
}
