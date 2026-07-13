import { Check, X } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReliabilityResult } from "@/types";

/**
 * 信效度结果表。展示各维度 α / KMO / Bartlett，标注是否达标，并附分档等级。
 * 分档等级来自后端 statistics_constants（优秀/良好/可接受/不达标）。
 */
export function ReliabilityTable({ results }: { results: ReliabilityResult[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-cream-surface hover:bg-cream-surface">
            <TableHead>维度</TableHead>
            <TableHead className="text-right">Cronbach&apos;s α</TableHead>
            <TableHead className="text-right">KMO</TableHead>
            <TableHead className="text-right">Bartlett p</TableHead>
            <TableHead className="w-24 text-center">达标</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r) => (
            <TableRow key={r.dimension}>
              <TableCell className="font-medium text-ink-900">{r.dimension}</TableCell>
              <TableCell className="text-right text-ink-700">
                <span className="tabular">{r.alpha.toFixed(3)}</span>
                {r.alphaGrade && (
                  <span className="ml-1.5 text-caption text-ink-400">({r.alphaGrade})</span>
                )}
              </TableCell>
              <TableCell className="text-right text-ink-700">
                <span className="tabular">{r.kmo.toFixed(3)}</span>
                {r.kmoGrade && (
                  <span className="ml-1.5 text-caption text-ink-400">({r.kmoGrade})</span>
                )}
              </TableCell>
              <TableCell className="text-right text-ink-700">
                <span className="tabular">
                  {r.bartlettPValue < 0.001 ? "<0.001" : r.bartlettPValue.toFixed(3)}
                </span>
                {r.bartlettGrade && (
                  <span className="ml-1.5 text-caption text-ink-400">({r.bartlettGrade})</span>
                )}
              </TableCell>
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
  );
}
