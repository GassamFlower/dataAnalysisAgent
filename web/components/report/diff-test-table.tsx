import { Check, X } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DiffTestResult } from "@/types";

/** p 值展示：<0.001 或保留 3 位小数 */
function formatP(p?: number | null): string {
  if (p === null || p === undefined) return "—";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}

/** 数值展示：null → —，否则保留 3 位 */
function formatNum(v?: number | null, digits = 3): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(digits);
}

/**
 * 差异检验结果表（对应架构文档 9.6 决策树）。
 * 展示假设路径的检验方法、统计量、p 值、效应量与显著性。
 * 结果由后端按假设路径实时计算，不落库。
 */
export function DiffTestTable({ results }: { results: DiffTestResult[] | null | undefined }) {
  if (!results || results.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-body text-ink-500">
        未配置假设路径，无差异检验结果。请在「生成数据」步骤中填写研究假设。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-cream-surface hover:bg-cream-surface">
            <TableHead>假设路径</TableHead>
            <TableHead>检验方法</TableHead>
            <TableHead className="text-right">统计量</TableHead>
            <TableHead className="text-right">p 值</TableHead>
            <TableHead className="text-right">效应量</TableHead>
            <TableHead className="w-20 text-center">显著</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r, i) => {
            const hasError = Boolean(r.error);
            return (
              <TableRow key={`${r.predictor}-${r.outcome}-${i}`}>
                <TableCell className="font-medium text-ink-900">
                  {r.predictor}
                  <span className="mx-1.5 text-ink-400">→</span>
                  {r.outcome}
                </TableCell>
                <TableCell className="text-ink-700">
                  {hasError ? (
                    <span className="text-destructive">{r.error}</span>
                  ) : (
                    r.methodName ?? r.method ?? "—"
                  )}
                </TableCell>
                <TableCell className="text-right text-ink-700">
                  <span className="tabular">{formatNum(r.statistic, 4)}</span>
                </TableCell>
                <TableCell className="text-right text-ink-700">
                  <span className="tabular">{formatP(r.pValue)}</span>
                </TableCell>
                <TableCell className="text-right text-ink-700">
                  {r.effectSize === null || r.effectSize === undefined ? (
                    <span className="text-ink-400">—</span>
                  ) : (
                    <span>
                      <span className="tabular">{r.effectSize.toFixed(3)}</span>
                      {r.effectSizeName && (
                        <span className="ml-1 text-caption text-ink-400">
                          {r.effectSizeName}
                        </span>
                      )}
                      {r.effectSizeGrade && (
                        <span className="ml-1.5 text-caption text-ink-400">
                          ({r.effectSizeGrade})
                        </span>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {r.significant === undefined ? (
                    <span className="text-ink-400">—</span>
                  ) : r.significant ? (
                    <Check className="mx-auto h-4 w-4 text-success" />
                  ) : (
                    <X className="mx-auto h-4 w-4 text-ink-400" />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {/* 解读区：展示每条路径的自然语言解读 */}
      <div className="border-t border-border px-4 py-3">
        <ul className="space-y-1.5">
          {results.map((r, i) =>
            r.interpretation ? (
              <li
                key={`interp-${i}`}
                className="text-small text-ink-600"
              >
                <span className="font-medium text-ink-700">
                  {r.predictor}→{r.outcome}：
                </span>
                {r.interpretation}
              </li>
            ) : null
          )}
        </ul>
      </div>
    </div>
  );
}
