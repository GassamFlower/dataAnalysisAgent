"use client";

import { ArrowLeftRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { QUESTION_TYPES } from "@/lib/constants";
import type { Question } from "@/types";
import { ConfidenceTag } from "./confidence-tag";

/**
 * 题目结构表。展示体检结果：题号 / 题干 / 题型 / 维度 / 反向题 / 置信度。
 * 对应宪法第 13 条：透明展示维度归属。
 *
 * 可选 onUpdateQuestion 传入时为可编辑模式（维度 Select + 反向题 Badge 可点击切换），
 * 不传时为只读模式（兼容其他调用方）。
 */

const CUSTOM_DIMENSION_VALUE = "__custom__";

interface QuestionTableProps {
  questions: Question[];
  dimensions: string[];
  /** 更新回调；传入则启用可编辑模式 */
  onUpdateQuestion?: (params: {
    questionIndex: number;
    updates: { dimension?: string; isReverse?: boolean };
  }) => void;
  /** 正在更新的题目 index（用于禁用控件） */
  updatingIndex?: number | null;
}

export function QuestionTable({
  questions,
  dimensions,
  onUpdateQuestion,
  updatingIndex,
}: QuestionTableProps) {
  const isEditable = !!onUpdateQuestion;

  const handleDimensionChange = (q: Question, value: string) => {
    if (!onUpdateQuestion) return;
    if (value === CUSTOM_DIMENSION_VALUE) {
      const custom = window.prompt("请输入新维度名称");
      if (custom && custom.trim()) {
        onUpdateQuestion({
          questionIndex: q.index,
          updates: { dimension: custom.trim() },
        });
      }
      return;
    }
    onUpdateQuestion({
      questionIndex: q.index,
      updates: { dimension: value },
    });
  };

  const handleReverseToggle = (q: Question) => {
    if (!onUpdateQuestion) return;
    onUpdateQuestion({
      questionIndex: q.index,
      updates: { isReverse: !q.isReverse },
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-cream-surface hover:bg-cream-surface">
            <TableHead className="w-16">题号</TableHead>
            <TableHead>题干</TableHead>
            <TableHead className="w-32">题型</TableHead>
            <TableHead className="w-40">维度</TableHead>
            <TableHead className="w-24">反向题</TableHead>
            <TableHead className="w-28">归属</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((q) => {
            const isUpdating = updatingIndex === q.index;
            // 维度不在选项里时（如用户自定义过），回退到"自定义..."
            const dimValue = dimensions.includes(q.dimension)
              ? q.dimension
              : CUSTOM_DIMENSION_VALUE;
            return (
              <TableRow key={q.index}>
                <TableCell className="tabular text-ink-500">{q.index}</TableCell>
                <TableCell className="text-ink-900">{q.text}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    {QUESTION_TYPES[q.questionType].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {isEditable ? (
                    <Select
                      value={dimValue}
                      disabled={isUpdating}
                      onValueChange={(v) => handleDimensionChange(q, v)}
                    >
                      <SelectTrigger className="h-8 text-body">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dimensions.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_DIMENSION_VALUE}>
                          + 自定义...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-ink-700">{q.dimension}</span>
                  )}
                </TableCell>
                <TableCell>
                  {isEditable ? (
                    <Badge
                      variant={q.isReverse ? "warning" : "outline"}
                      className="cursor-pointer font-normal select-none"
                      role="button"
                      aria-pressed={q.isReverse}
                      onClick={() => !isUpdating && handleReverseToggle(q)}
                    >
                      {q.isReverse ? (
                        <span className="inline-flex items-center gap-1">
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          反向
                        </span>
                      ) : (
                        <span className="text-ink-400">正向</span>
                      )}
                    </Badge>
                  ) : q.isReverse ? (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      反向
                    </span>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <ConfidenceTag confidence={q.confidence} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
