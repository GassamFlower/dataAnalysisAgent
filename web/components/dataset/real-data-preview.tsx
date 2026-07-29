"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DatasetInfo } from "@/lib/api/dataset";

interface RealDataPreviewProps {
  projectId: string;
  dataset: DatasetInfo;
}

/**
 * 真实数据导入成功后预览组件。
 *
 * 展示样本量、列名及前 10 行数据，并提供跳转报告页入口。
 */
export function RealDataPreview({ projectId, dataset }: RealDataPreviewProps) {
  const previewColumns = dataset.columns.slice(0, 8);
  const hasMoreColumns = dataset.columns.length > previewColumns.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <CardTitle className="text-h3 font-semibold text-ink-900">
              数据导入成功
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-cream-surface p-4">
              <p className="text-caption text-ink-400">样本量</p>
              <p className="mt-1 text-h2 font-semibold text-ink-900">
                {dataset.row_count}
              </p>
            </div>
            <div className="rounded-lg bg-cream-surface p-4">
              <p className="text-caption text-ink-400">变量数</p>
              <p className="mt-1 text-h2 font-semibold text-ink-900">
                {dataset.columns.length}
              </p>
            </div>
            <div className="rounded-lg bg-cream-surface p-4">
              <p className="text-caption text-ink-400">数据来源</p>
              <Badge variant="secondary" className="mt-1">
                真实回收
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {dataset.columns.map((col) => (
              <Badge key={col} variant="outline" className="font-mono">
                {col}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-h3 font-semibold text-ink-900">
              数据预览（前 10 行）
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {previewColumns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap">
                      {col}
                    </TableHead>
                  ))}
                  {hasMoreColumns && (
                    <TableHead className="text-ink-400">…</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataset.preview.map((row, idx) => (
                  <TableRow key={idx}>
                    {previewColumns.map((col) => (
                      <TableCell key={col} className="whitespace-nowrap">
                        {String(row[col] ?? "")}
                      </TableCell>
                    ))}
                    {hasMoreColumns && <TableCell>…</TableCell>}
                  </TableRow>
                ))}
                {dataset.preview.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={previewColumns.length + (hasMoreColumns ? 1 : 0)}
                      className="text-center text-ink-400"
                    >
                      暂无预览数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild size="lg">
          <Link href={`/projects/${projectId}/report`}>
            下一步：查看报告
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
