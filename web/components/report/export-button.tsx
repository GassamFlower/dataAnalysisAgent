"use client";

import { Download, FileText, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * 报告导出（宪法第 7 条：导出强制带水印，禁去痕迹）。
 * 支持 Word / Excel 两种格式。
 */
export function ExportButton({
  onExport,
  disabled,
}: {
  onExport?: (format: "word" | "excel") => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={disabled}>
          <Download className="mr-1.5 h-4 w-4" />
          导出报告
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExport?.("word")}>
          <FileText className="mr-2 h-4 w-4" />
          Word 文档（.docx）
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport?.("excel")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Excel 数据（.xlsx）
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
