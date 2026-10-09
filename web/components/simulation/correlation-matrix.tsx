"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
 * 标注【用户假设】vs【系统补全】，点击单元格直接输入数值编辑。
 */
export function CorrelationMatrix({
  matrix,
  onCellChange,
}: {
  matrix: CorrelationMatrix;
  /** 直接输入数值后回调（rowIdx, colIdx, value） */
  onCellChange?: (rowIdx: number, colIdx: number, value: number) => void;
}) {
  const { dimensions, cells } = matrix;
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const editable = !!onCellChange;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const cellColor = (v: number) => {
    const abs = Math.abs(v);
    if (abs < 0.2) return "bg-cream-muted/40";
    if (v > 0) return "bg-chart-4/15";
    return "bg-chart-1/15";
  };

  const startEdit = (row: number, col: number, value: number) => {
    if (!onCellChange) return;
    setEditing({ row, col });
    setEditValue(value.toFixed(2));
    setEditError("");
  };

  const commitEdit = (blur = false) => {
    if (!editing || !onCellChange) return;

    const raw = editValue.trim();
    const parsed = parseFloat(raw);
    if (raw === "" || Number.isNaN(parsed) || parsed < -1 || parsed > 1) {
      if (blur) {
        setEditing(null);
        setEditError("");
      } else {
        setEditError("请输入 [-1, 1] 范围内的数值");
      }
      return;
    }

    const rounded = Math.round(parsed * 100) / 100;
    onCellChange(editing.row, editing.col, rounded);
    setEditing(null);
    setEditError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitEdit(false);
    } else if (e.key === "Escape") {
      setEditing(null);
      setEditError("");
    }
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

                  const isEditing = editing?.row === i && editing?.col === j;

                  return (
                    <TableCell
                      key={colDim}
                      onClick={editable && !isEditing ? () => startEdit(i, j, cell.value) : undefined}
                      role={editable ? "button" : undefined}
                      className={cn(
                        "group relative text-center tabular",
                        editable && "cursor-pointer hover:ring-2 hover:ring-ring/40",
                        cellColor(cell.value)
                      )}
                    >
                      {isEditing ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => {
                              setEditValue(e.target.value);
                              if (editError) setEditError("");
                            }}
                            onBlur={() => commitEdit(true)}
                            onKeyDown={handleKeyDown}
                            className={cn(
                              "h-7 w-20 px-1 text-center text-ink-900",
                              editError && "border-destructive focus-visible:ring-destructive",
                            )}
                          />
                          {editError && (
                            <span className="text-[10px] text-destructive">{editError}</span>
                          )}
                        </div>
                      ) : (
                        <>
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
                        </>
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
        点击单元格可直接输入 [-1, 1] 范围内的相关系数，按 Enter 确认。
      </p>
    </div>
  );
}
