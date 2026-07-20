"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { StepNav } from "@/components/layout/step-nav";
import { StatCard } from "@/components/report/stat-card";
import { ReliabilityTable } from "@/components/report/reliability-table";
import { ReliabilityChart } from "@/components/report/reliability-chart";
import { CorrelationHeatmap } from "@/components/report/correlation-heatmap";
import { DiffTestTable } from "@/components/report/diff-test-table";
import { EffectSizeChart } from "@/components/report/effect-size-chart";
import { DiagnosisAlert } from "@/components/report/diagnosis-alert";
import { ExportButton } from "@/components/report/export-button";
import { PaidActionGuard } from "@/components/common/paid-action-guard";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Watermark } from "@/components/common/watermark";
import { SimulationReportBanner } from "@/components/compliance/simulation-report-banner";
import { Disclaimer } from "@/components/compliance/disclaimer";
import { DataSourceConfirmDialog } from "@/components/compliance/data-source-confirm-dialog";
import { toast } from "@/components/ui/toaster";
import { useReport, useAnalyzeReport, useExportReport } from "@/lib/hooks/use-report";
import { useSimulation } from "@/lib/hooks/use-simulation";
import { useProject } from "@/lib/hooks/use-project";
import { useQuota } from "@/lib/hooks/use-payment";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ReliabilityResult } from "@/types";

/**
 * 套用论文信效度段落模板（与后端 reporter._reliability_paragraph 一致）。
 * 从信效度结果实时拼装，供用户直接复制进论文方法部分。
 */
function buildReliabilityParagraph(
  results: ReliabilityResult[],
  overallAlpha: number
): string {
  const dimCount = results.length;
  if (dimCount === 0) return "暂无信效度数据。";
  const alphas = results.map((r) => r.alpha);
  const minAlpha = Math.min(...alphas);
  const maxAlpha = Math.max(...alphas);
  const kmos = results.map((r) => r.kmo);
  const avgKmo = kmos.reduce((s, v) => s + v, 0) / kmos.length;
  const bartlettPass = results.every((r) => r.bartlettPValue < 0.05);
  const alphaWording =
    overallAlpha >= 0.9
      ? "信度极好"
      : overallAlpha >= 0.8
      ? "信度良好"
      : overallAlpha >= 0.7
      ? "信度可接受"
      : "信度不足";
  const suitable = bartlettPass && avgKmo >= 0.5;
  return (
    `本量表共 ${dimCount} 个维度。信度检验显示，总量表 Cronbach's α = ${overallAlpha.toFixed(
      3
    )}（${alphaWording}），各维度 α 介于 ${minAlpha.toFixed(3)}～${maxAlpha.toFixed(
      3
    )}。效度检验中，KMO = ${avgKmo.toFixed(3)}，Bartlett 球形检验 p${
      bartlettPass ? "<0.05" : "≥0.05"
    }，${suitable ? "适合做因子分析" : "因子分析适用性需进一步评估"}。`
  );
}

export default function ReportPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: report, isLoading, isError, error } = useReport(params.id);
  const { data: simulationData } = useSimulation(params.id);
  const { data: project } = useProject(params.id);
  const analyzeMutation = useAnalyzeReport();
  const exportMutation = useExportReport();
  const userPlan = useAuthStore((state) => state.user?.plan ?? "free");
  const { data: quotaData } = useQuota();
  const isFreeUser = userPlan === "free";
  const exportQuota = quotaData?.quotas?.export;
  const [showDataSourceDialog, setShowDataSourceDialog] = useState(false);
  const [pendingExportFormat, setPendingExportFormat] = useState<
    "word" | "excel" | null
  >(null);

  /** 触发报告生成（后端跑统计套餐 + 诊断） */
  const handleAnalyze = () => {
    analyzeMutation.mutate(params.id, {
      onSuccess: () => {
        toast.success("报告生成成功");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "报告生成失败，请重试");
      },
    });
  };

  /** 点击导出按钮：先弹出数据来源确认 */
  const handleExportClick = (format: "word" | "excel") => {
    setPendingExportFormat(format);
    setShowDataSourceDialog(true);
  };

  /** 确认数据来源后触发浏览器下载 */
  const handleExportConfirm = (dataSource: "real" | "simulated") => {
    if (!pendingExportFormat) return;
    const format = pendingExportFormat;
    setShowDataSourceDialog(false);
    setPendingExportFormat(null);

    exportMutation.mutate(
      { projectId: params.id, format, dataSource },
      {
        onSuccess: ({ blob, filename }) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download =
            filename || `report.${format === "word" ? "docx" : "xlsx"}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("报告导出成功，请检查浏览器下载列表");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "导出失败，请重试");
        },
      }
    );
  };

  // 正在生成报告
  if (analyzeMutation.isPending) {
    return (
      <div>
        <StepNav projectId={params.id} current="report" />
        <LoadingState label="正在生成报告，运行统计套餐 + R4 诊断，预计 10-30 秒" />
      </div>
    );
  }

  // 接口失败：404 表示报告未生成，提供「生成报告」按钮；其他错误显示 ErrorState
  if (isError) {
    const isNotFound = error?.message?.includes("404") || error?.message?.includes("未找到报告");
    if (isNotFound) {
      return (
        <div>
          <StepNav projectId={params.id} current="report" />
          <Card className="mt-6 p-8 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-ink-400" />
            <h3 className="text-h3 font-semibold text-ink-900">尚未生成报告</h3>
            <p className="mt-1 text-body text-ink-500">
              请先完成数据生成，再运行统计分析生成报告。
            </p>
            <PaidActionGuard plan={userPlan} actionType="analysis">
              <Button className="mt-4" onClick={handleAnalyze}>
                <FileText className="mr-1.5 h-4 w-4" />
                生成报告
              </Button>
            </PaidActionGuard>
          </Card>
        </div>
      );
    }
    return (
      <div>
        <StepNav projectId={params.id} current="report" />
        <ErrorState
          title="加载报告失败"
          message={error?.message || "无法获取报告数据，请稍后重试"}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // 报告未生成：保持「尚未生成报告」卡片
  if (!isLoading && !report) {
    return (
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href={`/projects/${params.id}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回工作台
          </Link>
        </Button>
        <StepNav projectId={params.id} current="report" />
        <Card className="mt-6 p-8 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-ink-400" />
          <h3 className="text-h3 font-semibold text-ink-900">尚未生成报告</h3>
          <p className="mt-1 text-body text-ink-500">
            请先完成数据生成，再运行统计分析生成报告。
          </p>
          <PaidActionGuard plan={userPlan} actionType="analysis">
            <Button className="mt-4" onClick={handleAnalyze}>
              <FileText className="mr-1.5 h-4 w-4" />
              生成报告
            </Button>
          </PaidActionGuard>
        </Card>
      </div>
    );
  }

  const reliability = report?.reliability ?? [];
  const diagnosis = report?.diagnosis ?? { passed: true, issues: [] };
  const overallAlpha = report?.overallAlpha ?? 0;
  const passedCount = report?.passedCount ?? 0;
  const totalCount = report?.totalCount ?? reliability.length;
  const paragraph = buildReliabilityParagraph(reliability, overallAlpha);

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href={`/projects/${params.id}`}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          返回工作台
        </Link>
      </Button>

      <StepNav projectId={params.id} current="report" />

      <PageHeader
        title="预演报告"
        description="统计结果、R4 诊断与导出。仅用于研究预演。"
        actions={
          <ExportButton
            onExport={handleExportClick}
            disabled={exportMutation.isPending}
            isFree={isFreeUser}
            remaining={exportQuota?.remaining}
            limit={exportQuota?.limit}
          />
        }
      />

      <Watermark className="mb-4" />

      {/* 模拟数据报告 Banner（不可关闭） */}
      <SimulationReportBanner projectMode={project?.mode} />

      {isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card p-4 text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载报告…
        </div>
      )}

      {/* 总览指标卡 */}
      <section className="mb-8">
        <h2 className="mb-4 text-h2 font-semibold text-ink-900">总体概览</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="平均 Cronbach's α"
            value={overallAlpha}
            threshold="≥ 0.700"
            passed={overallAlpha >= 0.7}
          />
          <StatCard
            label="达标维度"
            value={`${passedCount}/${totalCount}`}
            threshold="全部达标"
            passed={passedCount === totalCount}
          />
          <StatCard
            label="样本量"
            value={report?.sampleSize ? String(report.sampleSize) : "—"}
            threshold="≥ 100"
            passed={report?.sampleSize ? report.sampleSize >= 100 : false}
          />
        </div>
      </section>

      {/* 信效度表 */}
      <section className="mb-8">
        <h2 className="mb-4 text-h2 font-semibold text-ink-900">
          各维度信效度
        </h2>
        <div className="mb-4">
          <ReliabilityChart results={reliability} />
        </div>
        <ReliabilityTable results={reliability} />
      </section>

      {/* 相关矩阵热力图（来自模拟阶段保存的矩阵） */}
      {simulationData?.matrix && simulationData.matrix.cells?.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-h2 font-semibold text-ink-900">
            相关矩阵
          </h2>
          <p className="mb-4 text-body text-ink-500">
            模拟阶段生成 / 用户编辑的相关系数矩阵。颜色越深表示相关性越强，砖红为正相关，橄榄为负相关。
          </p>
          <Card className="p-5">
            <CorrelationHeatmap matrix={simulationData.matrix} />
          </Card>
        </section>
      )}

      {/* 论文信效度段落（参考，可直接复制进论文方法部分） */}
      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-h2 font-semibold text-ink-900">
          <FileText className="h-5 w-5 text-ink-500" />
          论文信效度段落（参考）
        </h2>
        <Card className="p-5">
          <p className="leading-relaxed text-body text-ink-700">{paragraph}</p>
          <p className="mt-3 text-caption text-ink-400">
            本段落由信效度结果自动生成，可直接复制到论文方法部分。实际数据请以导出报告为准。
          </p>
        </Card>
      </section>

      {/* 差异检验（假设路径验证，对应架构文档 9.6 决策树） */}
      <section className="mb-8">
        <h2 className="mb-4 text-h2 font-semibold text-ink-900">
          假设检验（差异分析）
        </h2>
        <p className="mb-3 text-body text-ink-500">
          按假设路径自动选择检验方法（t检验/ANOVA/卡方/Pearson/回归），结果实时计算，不落库。
        </p>
        <div className="mb-4">
          <EffectSizeChart results={report?.diffTests ?? null} />
        </div>
        <DiffTestTable results={report?.diffTests ?? null} />
      </section>

      {/* R4 诊断 */}
      <section className="mb-8">
        <h2 className="mb-4 text-h2 font-semibold text-ink-900">
          R4 智能诊断
        </h2>
        <DiagnosisAlert diagnosis={diagnosis} />
      </section>

      {/* 导出区 */}
      <Card className="p-6">
        <h3 className="text-h3 font-semibold text-ink-900">导出报告</h3>
        <p className="mt-1 text-body text-ink-500">
          导出 Word / Excel 报告，含分档标签与论文段落。仅用于研究预演。
        </p>
        <div className="mt-4">
          <ExportButton
            onExport={handleExportClick}
            disabled={exportMutation.isPending}
            isFree={isFreeUser}
            remaining={exportQuota?.remaining}
            limit={exportQuota?.limit}
          />
        </div>
        {exportMutation.isPending && (
          <p className="mt-2 flex items-center gap-1.5 text-small text-ink-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在生成报告文件…
          </p>
        )}
      </Card>

      {/* 免责声明 */}
      <div className="mt-8">
        <Disclaimer variant="full" />
      </div>

      {/* 数据来源确认弹窗 */}
      <DataSourceConfirmDialog
        open={showDataSourceDialog}
        onOpenChange={setShowDataSourceDialog}
        onConfirm={handleExportConfirm}
        onCancel={() => {
          setShowDataSourceDialog(false);
          setPendingExportFormat(null);
        }}
        projectMode={project?.mode}
      />
    </div>
  );
}
