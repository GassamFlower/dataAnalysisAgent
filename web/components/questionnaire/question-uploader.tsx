"use client";

import { useState } from "react";
import { Upload, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * 题目上传组件（受控）。
 * 支持文件上传（.docx/.txt）或粘贴文本两种方式。
 * value/onChange 由父组件控制，便于模板填充。
 */
export function QuestionUploader({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"file" | "paste">("paste");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "paste" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("paste")}
          disabled={disabled}
        >
          <FileText className="mr-1.5 h-4 w-4" />
          粘贴文本
        </Button>
        <Button
          type="button"
          variant={mode === "file" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("file")}
          disabled={disabled}
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
          <Upload className="h-8 w-8 text-ink-400" />
          <p className="mt-3 text-body text-ink-700">
            点击或拖拽文件上传
          </p>
          <p className="mt-1 text-caption text-ink-400">
            支持 .docx / .txt，单文件 ≤ 2MB
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" disabled={disabled}>
            选择文件
          </Button>
        </div>
      )}
    </div>
  );
}
