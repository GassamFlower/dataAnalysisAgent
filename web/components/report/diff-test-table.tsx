import { Check, X } from "lucide-react";

import {
  DataCell,
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
    <div className="space-y-3">
      {/* 窄屏：每条假设一张卡片，避免横向滚动 */}
      <div className="space-y-3 md:hidden">
        {results.map((r, i) => {
          const hasError = Boolean(r.error);
          return (
            <div
              key={`${r.predictor}-${r.outcome}-${i}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-body font-semibold text-ink-900">
                  {r.predictor} <span className="text-ink-400">→</span> {r.outcome}
                </span>
                {r.significant === undefined ? null : (
                  <span
                    className={
                      "flex shrink-0 items-center gap-1 text-caption " +
                      (r.significant ? "text-success" : "text-ink-400")
                    }
                  >
                    {r.significant ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    {r.significant ? "显著" : "不显著"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-caption text-ink-400">
                {hasError ? (
                  <span className="text-destructive">{r.error}</span>
                ) : (
                  r.methodName ?? r.method ?? "—"
                )}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-cream-surface px-2 py-2">
                  <dt className="text-caption text-ink-400">统计量</dt>
                  <dd className="tabular text-body font-medium text-ink-900">
                    {formatNum(r.statistic, 4)}
                  </dd>
                </div>
                <div className="rounded-md bg-cream-surface px-2 py-2">
                  <dt className="text-caption text-ink-400">p 值</dt>
                  <dd className="tabular text-body font-medium text-ink-900">
                    {formatP(r.pValue)}
                  </dd>
                </div>
                <div className="rounded-md bg-cream-surface px-2 py-2">
                  <dt className="text-caption text-ink-400">效应量</dt>
                  <dd className="tabular text-body font-medium text-ink-900">
                    {formatNum(r.effectSize)}
                  </dd>
                </div>
              </dl>
              {r.interpretation ? (
                <p className="mt-3 text-small leading-relaxed text-ink-500">{r.interpretation}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
      <Table className="table-sticky-head">
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
                <DataCell className="text-ink-700">{formatNum(r.statistic, 4)}</DataCell>
                <DataCell className="text-ink-700">{formatP(r.pValue)}</DataCell>
                <DataCell className="text-ink-700">
                  {r.effectSize === null || r.effectSize === undefined ? (
                    <span className="text-ink-400">—</span>
                  ) : (
                    <span>
                      {r.effectSize.toFixed(3)}
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
                </DataCell>
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
                className="text-small text-ink-500"
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
    </div>
  );
}
