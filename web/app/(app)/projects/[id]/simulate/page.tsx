"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Play, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { StepNav } from "@/components/layout/step-nav";
import { HypothesisInput } from "@/components/simulation/hypothesis-input";
import { HypothesisPathList } from "@/components/simulation/hypothesis-path-list";
import { CorrelationMatrix } from "@/components/simulation/correlation-matrix";
import { SampleSizeInput } from "@/components/simulation/sample-size-input";
import { LoadingState } from "@/components/common/loading-state";
import { Watermark } from "@/components/common/watermark";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { PaidActionGuard } from "@/components/common/paid-action-guard";
import { SimulationCommitmentDialog } from "@/components/compliance/simulation-commitment-dialog";
import { DataSourceConfirmDialog } from "@/components/compliance/data-source-confirm-dialog";
import { toast } from "@/components/ui/toaster";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import {
  useSimulation,
  useParseHypothesis,
  useGenerateSimulation,
  useSaveMatrix,
  useExportDataset,
} from "@/lib/hooks/use-simulation";
import { useProject } from "@/lib/hooks/use-project";
import {
  useSimulationDisclaimerCheck,
  useConfirmSimulationDisclaimer,
} from "@/lib/hooks/use-compliance";
import {
  STRENGTH_TO_R,
  nextStrength,
  rToStrength,
} from "@/lib/constants";
import type { CorrelationMatrix as Matrix, HypothesisPath } from "@/types";

export default function SimulatePage({
  params,
}: {
  params: { id: string };
}) {
  const { hypothesisText, setHypothesisText, sampleSize, setSampleSize, paths, setPaths } =
    useSimulationStore();
  const user = useAuthStore((state) => state.user);
  const userPlan = user?.plan ?? "free";
  const [parseError, setParseError] = useState<string | null>(null);
  /** 本地编辑副本：初始/生成后与服务端同步，用户编辑只改本地 */
  const [localMatrix, setLocalMatrix] = useState<Matrix | null>(null);
  const [showCommitmentDialog, setShowCommitmentDialog] = useState(false);
  const [showDataSourceDialog, setShowDataSourceDialog] = useState(false);

  // 查询项目、已生成的矩阵 + 已保存假设
  const { data: project } = useProject(params.id);
  const { data: simulationData, isLoading, error, refetch } = useSimulation(params.id);
  const parseHypothesisMutation = useParseHypothesis();
  const generateMutation = useGenerateSimulation();
  const saveMatrixMutation = useSaveMatrix();
  const exportDatasetMutation = useExportDataset();
  const { data: disclaimerCheck } = useSimulationDisclaimerCheck();
  const confirmDisclaimerMutation = useConfirmSimulationDisclaimer();

  /** debounce 自动保存矩阵（用户编辑后 800ms 触发） */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件卸载时清除 timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  /** debounce 保存矩阵到后端 */
  const debouncedSaveMatrix = (matrixToSave: Matrix) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMatrixMutation.mutate(
        { projectId: params.id, matrix: matrixToSave },
        {
          onError: () => {
            toast.error("矩阵保存失败，编辑可能不会保留");
          },
        }
      );
    }, 800);
  };

  const serverMatrix = simulationData?.matrix;
  const savedHypothesisText = simulationData?.hypothesisText ?? null;
  const savedPaths = simulationData?.paths ?? null;
  const matrix = localMatrix ?? serverMatrix;
  const hasMatrix = matrix && matrix.cells && matrix.cells.length > 0;

  // 服务端矩阵变化时（首次加载 / 重新生成）同步到本地
  useEffect(() => {
    setLocalMatrix(serverMatrix ?? null);
  }, [serverMatrix]);

  // 首次加载时若 store 为空且服务端有已保存假设，回填到 store
  useEffect(() => {
    if (savedHypothesisText && !hypothesisText) {
      setHypothesisText(savedHypothesisText);
    }
    if (savedPaths && savedPaths.length > 0 && paths.length === 0) {
      setPaths(savedPaths);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedHypothesisText, savedPaths]);

  // 点击单元格：循环切换强度档位（弱→中→强→弱），保留符号，对称更新
  const handleCellClick = (rowIdx: number, colIdx: number) => {
    if (!matrix) return;
    const cell = matrix.cells[rowIdx]?.[colIdx];
    if (!cell) return;
    const currentTier = rToStrength(Math.abs(cell.value));
    const nextTier = nextStrength(currentTier);
    const sign = cell.value === 0 ? 1 : Math.sign(cell.value);
    const newValue = Number((STRENGTH_TO_R[nextTier] * sign).toFixed(2));
    updateMatrixCell(rowIdx, colIdx, newValue);
  };

  // 直接输入数值：校验 [-1, 1]，对称更新，标记为用户编辑
  const handleCellChange = (rowIdx: number, colIdx: number, value: number) => {
    updateMatrixCell(rowIdx, colIdx, value);
  };

  const updateMatrixCell = (rowIdx: number, colIdx: number, newValue: number) => {
    setLocalMatrix((prev) => {
      if (!prev) return prev;
      const newMatrix = {
        ...prev,
        cells: prev.cells.map((row, i) =>
          row.map((cell, j) => {
            if ((i === rowIdx && j === colIdx) || (i === colIdx && j === rowIdx)) {
              return { ...cell, value: newValue, source: "user" as const };
            }
            return cell;
          })
        ),
      };
      // debounce 保存到后端（持久化用户编辑）
      debouncedSaveMatrix(newMatrix);
      return newMatrix;
    });
  };

  // 假设解析
  const handleParse = () => {
    if (!hypothesisText.trim()) {
      setParseError("请输入研究假设");
      return;
    }

    setParseError(null);
    parseHypothesisMutation.mutate(
      { projectId: params.id, rawText: hypothesisText },
      {
        onSuccess: (data) => {
          setPaths(data.paths);
        },
        onError: (err) => {
          setParseError(err instanceof Error ? err.message : "解析失败");
        },
      }
    );
  };

  // 实际执行模拟数据生成
  const executeGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        projectId: params.id,
        sampleSize,
      });

      toast.success("数据生成成功");
    } catch (err) {
      console.error("生成失败:", err);
      toast.error(err instanceof Error ? err.message : "生成失败，请重试");
    }
  };

  // 生成数据 - 首次使用需先同意模拟数据承诺
  const handleGenerate = async () => {
    if (!hypothesisText.trim()) {
      toast.warning("请先输入并解析研究假设");
      return;
    }

    if (paths.length === 0) {
      toast.warning("假设路径为空，请先解析假设");
      return;
    }

    if (!disclaimerCheck?.has_agreed) {
      setShowCommitmentDialog(true);
      return;
    }

    await executeGenerate();
  };

  // 承诺确认后，记录同意并执行生成
  const handleCommitmentConfirm = async () => {
    setShowCommitmentDialog(false);

    try {
      await confirmDisclaimerMutation.mutateAsync();
      await executeGenerate();
    } catch (err) {
      console.error("承诺记录失败:", err);
      toast.error(err instanceof Error ? err.message : "承诺记录失败，请重试");
    }
  };

  /** 点击导出按钮：先弹出数据来源确认 */
  const handleExportDatasetClick = () => {
    setShowDataSourceDialog(true);
  };

  /** 确认数据来源后导出模拟数据集 */
  const handleExportDatasetConfirm = (dataSource: "real" | "simulated") => {
    setShowDataSourceDialog(false);
    exportDatasetMutation.mutate(
      { projectId: params.id, format: "excel", dataSource },
      {
        onSuccess: ({ blob, filename }) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename || `dataset_${params.id}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("数据集导出成功，请检查浏览器下载列表");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "导出失败，请重试");
        },
      }
    );
  };

  // Loading 状态
  if (isLoading) {
    return (
      <div>
        <StepNav projectId={params.id} current="simulate" />
        <LoadingState label="正在加载预演数据..." />
      </div>
    );
  }

  // Error 状态
  if (error) {
    return (
      <div>
        <StepNav projectId={params.id} current="simulate" />
        <ErrorState
          title="加载失败"
          message={error.message || "无法获取预演数据，请稍后重试"}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href={`/projects/${params.id}`}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          返回工作台
        </Link>
      </Button>

      <StepNav projectId={params.id} current="simulate" />

      <PageHeader
        title="数据预演"
        description="用一句话描述假设，系统补全相关矩阵并透明展示，可自由编辑。"
        actions={
          <Button asChild>
            <Link href={`/projects/${params.id}/report`}>
              下一步：查看报告
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <Watermark className="mb-4" />

      <div className="space-y-6">
        {/* 步骤 1：假设输入（A 体验） */}
        <Card className="p-6">
          <div className="mb-1 flex items-center gap-2 text-caption font-medium text-ink-400">
            <span>步骤 1</span>
          </div>
          <h3 className="text-h3 font-semibold text-ink-900">描述研究假设</h3>
          <div className="mt-4">
            <HypothesisInput
              value={hypothesisText}
              onChange={setHypothesisText}
              parsing={parseHypothesisMutation.isPending}
              onParse={handleParse}
            />
            {parseError && (
              <p className="mt-2 text-caption text-error">{parseError}</p>
            )}
            <HypothesisPathList
              paths={paths}
              onStrengthChange={(idx, strength) =>
                setPaths(paths.map((p, i) => (i === idx ? { ...p, strength } : p)))
              }
              onDirectionChange={(idx, direction) =>
                setPaths(paths.map((p, i) => (i === idx ? { ...p, direction } : p)))
              }
              onDelete={(idx) => setPaths(paths.filter((_, i) => i !== idx))}
              onAdd={(path) => setPaths([...paths, path])}
              dimensions={
                matrix?.dimensions ??
                Array.from(new Set(paths.flatMap((p) => [p.predictor, p.outcome])))
              }
            />
          </div>
        </Card>

        {/* 步骤 2：相关矩阵（C 底层 + 透明展示） */}
        <Card className="p-6">
          <div className="mb-1 text-caption font-medium text-ink-400">
            步骤 2
          </div>
          <h3 className="text-h3 font-semibold text-ink-900">
            相关矩阵（可编辑）
          </h3>
          <p className="mt-1 text-body text-ink-500">
            假设路径标为【用户假设】，其余为【系统补全】，可逐项调整。
          </p>
          <div className="mt-4">
            {hasMatrix ? (
              <CorrelationMatrix
                matrix={matrix}
                onCellClick={
                  generateMutation.isPending ? undefined : handleCellClick
                }
                onCellChange={
                  generateMutation.isPending ? undefined : handleCellChange
                }
              />
            ) : (
              <EmptyState
                title="暂无相关矩阵"
                description="请先输入假设并生成数据"
              />
            )}
          </div>
        </Card>

        {/* 步骤 3：样本量 + 生成 */}
        <Card className="p-6">
          <div className="mb-1 text-caption font-medium text-ink-400">
            步骤 3
          </div>
          <h3 className="text-h3 font-semibold text-ink-900">样本量与生成</h3>
          <div className="mt-4 max-w-md">
            <SampleSizeInput value={sampleSize} onChange={setSampleSize} />
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            {hasMatrix && (
              <PaidActionGuard plan={userPlan} actionType="export">
                <Button
                  variant="outline"
                  onClick={handleExportDatasetClick}
                  disabled={exportDatasetMutation.isPending}
                >
                  {exportDatasetMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1.5 h-4 w-4" />
                  )}
                  {exportDatasetMutation.isPending ? "导出中..." : "导出数据集"}
                </Button>
              </PaidActionGuard>
            )}
            <PaidActionGuard plan={userPlan} actionType="simulation">
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={generateMutation.isPending || paths.length === 0}
              >
                <Play className="mr-1.5 h-4 w-4" />
                {generateMutation.isPending
                  ? "生成中..."
                  : `生成模拟数据（${sampleSize} 份）`}
              </Button>
            </PaidActionGuard>
          </div>
          {generateMutation.isError && (
            <p className="mt-2 text-caption text-error">
              生成失败：{generateMutation.error.message}
            </p>
          )}
        </Card>
      </div>

      {/* 模拟数据承诺框 */}
      <SimulationCommitmentDialog
        open={showCommitmentDialog}
        onOpenChange={setShowCommitmentDialog}
        onConfirm={handleCommitmentConfirm}
        onCancel={() => setShowCommitmentDialog(false)}
      />

      {/* 数据来源确认弹窗 */}
      <DataSourceConfirmDialog
        open={showDataSourceDialog}
        onOpenChange={setShowDataSourceDialog}
        onConfirm={handleExportDatasetConfirm}
        onCancel={() => setShowDataSourceDialog(false)}
        projectMode={project?.mode}
      />
    </div>
  );
}
