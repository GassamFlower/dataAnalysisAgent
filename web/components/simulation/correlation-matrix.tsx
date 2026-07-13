"use client";

import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CorrelationMatrix } from "@/types";
import { cn } from "@/lib/utils";

/**
 * 相关矩阵可视化（宪法第 12、13 条：透明展示）。
 * 标注【用户假设】vs【系统补全】，可编辑。
 */
export function CorrelationMatrix({
  matrix,
  onCellClick,
}: {
  matrix: CorrelationMatrix;
  /** 点击非对角单元格回调（rowIdx, colIdx） */
  onCellClick?: (rowIdx: number, colIdx: number) => void;
}) {
  const { dimensions, cells } = matrix;

  const cellColor = (v: number) => {
    const abs = Math.abs(v);
    if (abs < 0.2) return "bg-cream-muted/40";
    if (v > 0) return "bg-chart-4/15";
    return "bg-chart-1/15";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-caption text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="default" className="font-normal">用户假设</Badge>
          来自一句话解析
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="secondary" className="font-normal">系统补全</Badge>
          可编辑覆盖
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-cream-surface hover:bg-cream-surface">
              <TableHead className="w-32">维度</TableHead>
              {dimensions.map((d) => (
                <TableHead key={d} className="text-center">{d}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dimensions.map((rowDim, i) => (
              <TableRow key={rowDim}>
                <TableCell className="font-medium text-ink-900">{rowDim}</TableCell>
                {dimensions.map((colDim, j) => {
                  const cell = cells[i]?.[j];
                  if (!cell || i === j) {
                    return (
                      <TableCell key={colDim} className="text-center text-ink-400">
                        {i === j ? "—" : ""}
                      </TableCell>
                    );
                  }
                  const editable = !!onCellClick;
                  return (
                    <TableCell
                      key={colDim}
                      onClick={editable ? () => onCellClick!(i, j) : undefined}
                      role={editable ? "button" : undefined}
                      className={cn(
                        "group relative text-center tabular",
                        editable && "cursor-pointer hover:ring-2 hover:ring-ring/40",
                        cellColor(cell.value)
                      )}
                    >
                      <span className="pointer-events-none text-ink-900">
                        {cell.value.toFixed(2)}
                      </span>
                      {cell.source === "user" ? (
                        <Badge
                          variant="default"
                          className="pointer-events-none ml-1 px-1 py-0 text-[10px]"
                        >
                          假设
                        </Badge>
                      ) : null}
                      {editable && (
                        <Pencil className="pointer-events-none absolute right-1 top-1.5 h-3 w-3 text-ink-400 opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-caption text-ink-400">
        点击单元格可调整强度档位（弱 / 中 / 强），不暴露原始 r 值。
      </p>
    </div>
  );
}
