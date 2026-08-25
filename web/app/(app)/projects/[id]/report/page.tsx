"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Sparkles, Target, LifeBuoy, MessageCircle as WechatIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { StepNav } from "@/components/layout/step-nav";
import { StatCard } from "@/components/report/stat-card";
import { ReliabilityTable } from "@/components/report/reliability-table";
import { ReliabilityChart } from "@/components/report/reliability-chart";
import { CorrelationHeatmap } from "@/components/report/correlation-heatmap";
import { DiffTestTable } from "@/components/report/diff-test-table";
import { EffectSizeChart } from "@/components/report/effect-size-chart";
import { DiagnosisAlert } from "@/components/report/diagnosis-alert";
import { SampleRepresentativeness } from "@/components/report/sample-representativeness";
import { SampleSizePlanner } from "@/components/report/sample-size-planner";
import { ExportButton } from "@/components/report/export-button";
import { PolishButton } from "@/components/report/polish-button";
import { PaperSections } from "@/components/report/paper-sections";
import { PaidActionGuard } from "@/components/common/paid-action-guard";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Watermark } from "@/components/common/watermark";
import { SimulationReportBanner } from "@/components/compliance/simulation-report-banner";
import { ContactForm } from "@/components/contact/contact-form";
import { WechatEntry } from "@/components/contact/wechat-entry";
import { Disclaimer } from "@/components/compliance/disclaimer";
import { DataSourceConfirmDialog } from "@/components/compliance/data-source-confirm-dialog";
import { MetricTooltip } from "@/components/tutorial/MetricTooltip";
import { OnboardingTour } from "@/components/tutorial/OnboardingTour";
import { AIInterpretButton } from "@/components/tutorial/AIInterpretButton";
import { Reveal } from "@/components/motion/reveal";
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
    "word" | "excel" | "pdf" | "ppt" | null
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
  const handleExportClick = (format: "word" | "excel" | "pdf" | "ppt") => {
    setPendingExportFormat(format);
    setShowDataSourceDialog(true);
  };

  /** 确认数据来源后触发浏览器下载 */
  const handleExportConfirm = (
    dataSource: "real" | "simulated",
    includeAiConclusion: boolean
  ) => {
    if (!pendingExportFormat) return;
    const format = pendingExportFormat;
    setShowDataSourceDialog(false);
    setPendingExportFormat(null);

    exportMutation.mutate(
      { projectId: params.id, format, dataSource, includeAiConclusion },
      {
        onSuccess: ({ blob, filename }) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const ext =
            format === "word"
              ? "docx"
              : format === "excel"
              ? "xlsx"
              : format === "ppt"
              ? "pptx"
              : "pdf";
          a.download = filename || `report.${ext}`;
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
        <LoadingState label="正在生成报告，运行统计套餐 + 智能诊断，预计 10-30 秒" />
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
        description="统计结果、智能诊断与导出。仅用于研究预演。"
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

      {/* 模拟数据报告 Banner（不可关闭）；传入预演命中率以标注达标情况与失效假设 */}
      <SimulationReportBanner
        projectMode={project?.mode}
        hitRate={simulationData?.hitRate ?? null}
      />

      {/* 数据分析救急区：自动关联当前项目与数据源（真实/模拟），可转人工分析 */}
      <section className="mt-4">
        <Card className="flex flex-col items-start justify-between gap-4 border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-h3 font-semibold text-ink-900">数据分析救急</h3>
              <p className="mt-1 text-body text-ink-600">
                结果不达标、不知道用什么方法？留言求助，我们会帮你定位问题，
                命中“愿意转人工分析”将转交人工顾问跟进。
              </p>
              <p className="mt-1 text-caption text-ink-400">
                已自动关联当前项目与数据源
                {project?.mode === "real" ? "（真实数据）" : "（模拟预演）"}。
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ContactForm
              defaultTag="rescue"
              projectId={params.id}
              dataSource={project?.mode ?? null}
              entryPoint="report-rescue"
              trigger={<Button>留言求助</Button>}
            />
            <WechatEntry
              trigger={
                <Button variant="outline">
                  <WechatIcon className="mr-1.5 h-4 w-4" />
                  一键加客服微信
                </Button>
              }
            />
          </div>
        </Card>
      </section>

      {isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card p-4 text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载报告…
        </div>
      )}

      <Reveal onView={false} delay={0.05}>
        <Tabs defaultValue="stats" className="mt-2">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="stats">统计结果</TabsTrigger>
          <TabsTrigger value="hypothesis">假设检验</TabsTrigger>
          <TabsTrigger value="sample">样本质量</TabsTrigger>
          <TabsTrigger value="diagnosis">智能诊断</TabsTrigger>
          <TabsTrigger value="paper">论文段落</TabsTrigger>
          <TabsTrigger value="export">导出</TabsTrigger>
        </TabsList>

        {/* Tab 1：统计结果（总览 + 信效度 + 相关矩阵 + 论文段落） */}
        <TabsContent value="stats" className="space-y-8">
          {/* 总览指标卡 */}
          <section>
            <h2 className="mb-4 text-h2 font-semibold text-ink-900">总体概览</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="平均 Cronbach's α"
                value={overallAlpha}
                threshold="≥ 0.700"
                passed={overallAlpha >= 0.7}
                tooltipType="alpha"
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
                tooltipType="sample_size"
              />
            </div>
          </section>

          {/* 信效度表 */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-h2 font-semibold text-ink-900">
                各维度信效度
              </h2>
              {report?.id && (
                <PolishButton
                  reportId={String(report.id)}
                  section="reliability"
                  report={report}
                />
              )}
            </div>
            <div className="mb-4">
              <ReliabilityChart results={reliability} />
            </div>
            <ReliabilityTable results={reliability} />
          </section>

          {/* 相关矩阵热力图（来自模拟阶段保存的矩阵） */}
          {simulationData?.matrix && simulationData.matrix.cells?.length > 0 && (
            <section>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-h2 font-semibold text-ink-900">
                  相关矩阵
                  <MetricTooltip metricType="correlation" />
                </h2>
                {report?.id && (
                  <PolishButton
                    reportId={String(report.id)}
                    section="correlation"
                    report={report}
                  />
                )}
              </div>
              <p className="mb-4 text-body text-ink-500">
                模拟阶段生成 / 用户编辑的相关系数矩阵。颜色越深表示相关性越强，砖红为正相关，橄榄为负相关。
              </p>
              <Card className="p-5">
                <CorrelationHeatmap matrix={simulationData.matrix} />
              </Card>
            </section>
          )}

          {/* 论文信效度段落（参考，可直接复制进论文方法部分） */}
          <section>
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
        </TabsContent>

        {/* Tab 2：假设检验（差异分析，对应架构文档 9.6 决策树） */}
        <TabsContent value="hypothesis" className="space-y-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-h2 font-semibold text-ink-900">
                假设检验（差异分析）
                <MetricTooltip metricType="diff_test" />
              </h2>
              <p className="mt-1 text-body text-ink-500">
                按假设路径自动选择检验方法（t检验/ANOVA/卡方/Pearson/回归），结果实时计算，不落库。
              </p>
            </div>
            {report?.id && (
              <PolishButton
                reportId={String(report.id)}
                section="diff_test"
                report={report}
              />
            )}
          </div>
          <div className="mb-4">
            <EffectSizeChart results={report?.diffTests ?? null} />
          </div>
          <DiffTestTable results={report?.diffTests ?? null} />
        </TabsContent>

        {/* Tab 3：样本质量（代表性诊断 + 规划对照联动） */}
        <TabsContent value="sample" className="space-y-8">
          {/* 样本代表性诊断（F-RPT-007，仅真实数据项目；免费） */}
          <section>
            <h2 className="mb-4 text-h2 font-semibold text-ink-900">
              样本代表性诊断
            </h2>
            <p className="mb-4 text-body text-ink-500">
              基于真实回收数据的样本结构体检：样本量是否足够、性别分布是否失衡、结构是否过度集中。只做诊断与建议，不提供样本购买/投放服务。
            </p>
            <SampleRepresentativeness projectId={params.id} />
          </section>

          {/* 样本量规划与回收目标（F-RPT-008；已收 N 自动带入，与代表性诊断互文） */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-h2 font-semibold text-ink-900">
              样本量规划与回收目标
              <MetricTooltip metricType="sample_size" />
            </h2>
            <p className="mb-4 text-body text-ink-500">
              按分析类型与效应量计算所需样本量并给出回收目标。已自动带入已收 N（报告样本量），
              下方直接给出「已收 vs 目标」达标判定：回收前定目标，回收后验结构。
            </p>
            {report?.sampleSize != null && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-ink-800">
                <Target className="h-4 w-4 shrink-0 text-primary" />
                已收 N = <b>{report.sampleSize}</b>，与建议回收目标对照判定如下。
              </div>
            )}
            <SampleSizePlanner
              projectId={params.id}
              defaultPlannedN={report?.sampleSize ?? null}
            />
          </section>
        </TabsContent>

        {/* Tab 4：智能诊断 + AI 解读 */}
        <TabsContent value="diagnosis" className="space-y-8">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-h2 font-semibold text-ink-900">
                智能诊断
                <MetricTooltip metricType="diagnosis" />
              </h2>
              {report?.id && (
                <PolishButton
                  reportId={String(report.id)}
                  section="diagnosis"
                  report={report}
                />
              )}
            </div>
            <DiagnosisAlert diagnosis={diagnosis} />
          </section>

          {/* AI 解读助手（阶段三） */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-h2 font-semibold text-ink-900">
              <Sparkles className="h-5 w-5 text-primary" />
              AI 解读助手
            </h2>
            <p className="mb-4 text-body text-ink-500">
              让 AI 用通俗语言解读你的统计结果，并给出可直接写入论文的段落建议。免费用户每周 1 次。
            </p>
            <AIInterpretButton projectId={params.id} section="overall" />
          </section>
        </TabsContent>

        {/* Tab 5：导出 */}
        <TabsContent value="export" className="space-y-8">
          <Card className="p-6">
            <h3 className="text-h3 font-semibold text-ink-900">导出报告</h3>
            <p className="mt-1 text-body text-ink-500">
              导出 Word / Excel / PDF / PPT 报告，含分档标签、论文段落、样本代表性诊断与样本量规划。仅用于研究预演。
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
          <Disclaimer variant="full" />
        </TabsContent>

        <TabsContent value="paper" className="space-y-8">
          <Card className="p-6">
            <h3 className="text-h3 font-semibold text-ink-900">论文段落</h3>
            <p className="mt-1 text-body text-ink-500">
              按「方法 / 结果 / 讨论」单选，一键生成对齐实际统计输出（Cronbach α、差异检验
              P 值、效应量、预演命中率）的 APA 段落。仅结果规范化描述，不代写研究结论。
            </p>
            {report?.id ? (
              <div className="mt-4">
                <PaperSections reportId={String(report.id)} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                生成报告后可生成论文段落。
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
      </Reveal>

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

      {/* 新手引导 */}
      <OnboardingTour projectId={params.id} />
    </div>
  );
}
