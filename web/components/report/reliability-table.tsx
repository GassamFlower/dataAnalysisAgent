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
import { MetricTooltip } from "@/components/tutorial/MetricTooltip";
import type { ReliabilityResult } from "@/types";

/**
 * 信效度结果表。展示各维度 α / KMO / Bartlett，标注是否达标，并附分档等级。
 * 分档等级来自后端 statistics_constants（优秀/良好/可接受/不达标）。
 */
export function ReliabilityTable({ results }: { results: ReliabilityResult[] }) {
  return (
    <div className="space-y-3">
      {/* 窄屏：每个维度一张卡片，避免横向滚动 */}
      <div className="space-y-3 md:hidden">
        {results.map((r) => (
          <div key={r.dimension} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-body-lg font-semibold text-ink-900">{r.dimension}</span>
              <span
                className={
                  "flex items-center gap-1 text-caption " +
                  (r.passed ? "text-success" : "text-destructive")
                }
              >
                {r.passed ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                {r.passed ? "达标" : "未达标"}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-md bg-cream-surface px-2 py-2 text-center">
                <dt className="text-caption text-ink-400">Cronbach&apos;s α</dt>
                <dd className="tabular text-body font-medium text-ink-900">
                  {r.alpha.toFixed(3)}
                </dd>
                {r.alphaGrade ? (
                  <dd className="text-caption text-ink-400">{r.alphaGrade}</dd>
                ) : null}
              </div>
              <div className="rounded-md bg-cream-surface px-2 py-2 text-center">
                <dt className="text-caption text-ink-400">KMO</dt>
                <dd className="tabular text-body font-medium text-ink-900">
                  {r.kmo.toFixed(3)}
                </dd>
                {r.kmoGrade ? (
                  <dd className="text-caption text-ink-400">{r.kmoGrade}</dd>
                ) : null}
              </div>
              <div className="rounded-md bg-cream-surface px-2 py-2 text-center">
                <dt className="text-caption text-ink-400">Bartlett p</dt>
                <dd className="tabular text-body font-medium text-ink-900">
                  {r.bartlettPValue < 0.001 ? "<0.001" : r.bartlettPValue.toFixed(3)}
                </dd>
                {r.bartlettGrade ? (
                  <dd className="text-caption text-ink-400">{r.bartlettGrade}</dd>
                ) : null}
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
      <Table className="table-sticky-head">
        <TableHeader>
          <TableRow className="bg-cream-surface hover:bg-cream-surface">
            <TableHead>维度</TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">
                Cronbach&apos;s α
                <MetricTooltip metricType="alpha" />
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">
                KMO
                <MetricTooltip metricType="kmo" />
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">
                Bartlett p
                <MetricTooltip metricType="bartlett" />
              </span>
            </TableHead>
            <TableHead className="w-24 text-center">达标</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r) => (
            <TableRow key={r.dimension}>
              <TableCell className="font-medium text-ink-900">{r.dimension}</TableCell>
              <DataCell className="text-ink-700">
                {r.alpha.toFixed(3)}
                {r.alphaGrade && (
                  <span className="ml-1.5 text-caption text-ink-400">({r.alphaGrade})</span>
                )}
              </DataCell>
              <DataCell className="text-ink-700">
                {r.kmo.toFixed(3)}
                {r.kmoGrade && (
                  <span className="ml-1.5 text-caption text-ink-400">({r.kmoGrade})</span>
                )}
              </DataCell>
              <DataCell className="text-ink-700">
                {r.bartlettPValue < 0.001 ? "<0.001" : r.bartlettPValue.toFixed(3)}
                {r.bartlettGrade && (
                  <span className="ml-1.5 text-caption text-ink-400">({r.bartlettGrade})</span>
                )}
              </DataCell>
              <TableCell className="text-center">
                {r.passed ? (
                  <Check className="mx-auto h-4 w-4 text-success" />
                ) : (
                  <X className="mx-auto h-4 w-4 text-destructive" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
