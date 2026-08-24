"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calculator,
  Target,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSampleSizePlanner } from "@/lib/hooks/use-report";
import type { SampleSizePlannerResult } from "@/types";

const ANALYSIS_OPTIONS = [
  { value: "correlation", label: "相关分析" },
  { value: "t_test", label: "独立样本 t 检验" },
  { value: "paired_t_test", label: "配对样本 t 检验" },
  { value: "anova", label: "单因素方差分析（ANOVA）" },
  { value: "regression", label: "多元回归分析" },
  { value: "stratified", label: "分层抽样" },
] as const;

type AnalysisType = (typeof ANALYSIS_OPTIONS)[number]["value"];

/** 各分析类型的效应量 placeholder 与说明 */
const EFFECT_PLACEHOLDER: Record<AnalysisType, string> = {
  correlation: "r，如 0.3",
  t_test: "d，如 0.5",
  paired_t_test: "dz，如 0.5",
  anova: "f，如 0.25",
  regression: "（回归按自变量数估算）",
  stratified: "（分层按设计效应估算）",
};

const ALPHA_OPTIONS = [
  { value: "0.01", label: "0.01（更严格）" },
  { value: "0.05", label: "0.05（常规）" },
  { value: "0.10", label: "0.10（宽松）" },
] as const;

const POWER_OPTIONS = [
  { value: "0.80", label: "80%（常规）" },
  { value: "0.90", label: "90%（更稳）" },
] as const;

const SOURCE_LABEL: Record<string, string> = {
  user: "你手填的效应量",
  simulation: "取自预演相关矩阵",
  default: "默认中等效应",
};

const VERDICT_CONFIG = {
  sufficient: { label: "达标", cls: "tone-success-surface", Icon: CheckCircle2 },
  marginal: { label: "够功效但低于建议下限", cls: "tone-warning-surface", Icon: AlertTriangle },
  insufficient: { label: "不足", cls: "tone-danger-surface", Icon: XCircle },
  unknown: { label: "待填计划样本量", cls: "border-muted bg-muted/50 text-ink-700", Icon: Target },
};

/**
 * 样本量规划卡片（F-RPT-008）。
 * 预演闭环：预演效应量 → 建议回收目标 → 回收后样本代表性诊断回看。
 * 确定性公式计算（无 LLM），免费能力。只做规划与建议，不提供样本购买/投放/收集服务。
 *
 * defaultPlannedN：报告页联动入参——自动带入「已收 N」（报告样本量），
 * 使规划结果直接给出「已收 vs 目标」达标判定。
 * recommendedAnalysisType：模拟页联动入参——根据模拟页假设路径自动推荐分析类型，
 * 首次渲染自动带入（不覆盖用户手动切换）。
 */
export function SampleSizePlanner({
  projectId,
  defaultPlannedN,
  recommendedAnalysisType,
}: {
  projectId: string;
  defaultPlannedN?: number | null;
  recommendedAnalysisType?: AnalysisType;
}) {
  const mutation = useSampleSizePlanner(projectId);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("correlation");
  const [effectSize, setEffectSize] = useState("");
  const [alpha, setAlpha] = useState("0.05");
  const [power, setPower] = useState("0.80");
  const [groups, setGroups] = useState("3");
  const [strata, setStrata] = useState("2");
  const [plannedN, setPlannedN] = useState("");
  const plannedPrefilled = useRef(false);
  const analysisTypePrefilled = useRef(false);

  // 联动：模拟页推荐分析类型到位后自动带入（仅首次，不覆盖用户手动切换）
  useEffect(() => {
    if (recommendedAnalysisType && !analysisTypePrefilled.current) {
      setAnalysisType(recommendedAnalysisType);
      analysisTypePrefilled.current = true;
    }
  }, [recommendedAnalysisType]);

  // 联动：已收 N 到位后自动带入计划样本量（仅首次，不覆盖用户手填）
  useEffect(() => {
    if (!plannedPrefilled.current && defaultPlannedN != null) {
      plannedPrefilled.current = true;
      setPlannedN(String(defaultPlannedN));
    }
  }, [defaultPlannedN]);

  // 首次进入自动按默认参数计算（后端自动解析预演矩阵效应量）；
  // defaultPlannedN 到位时自动重算一次，产出「已收 vs 目标」判定
  useEffect(() => {
    runPlan(defaultPlannedN != null ? String(defaultPlannedN) : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, defaultPlannedN]);

  const runPlan = (plannedOverride?: string) => {
    const plannedRaw = plannedOverride ?? plannedN;
    const effect = effectSize.trim() ? Number(effectSize) : null;
    // 相关分析 r 需在 (0,1) 内；其余效应量（d/dz/f）只需 > 0
    const isCorrelation = analysisType === "correlation";
    if (
      effect !== null &&
      (Number.isNaN(effect) ||
        effect <= 0 ||
        (isCorrelation && effect >= 1))
    ) {
      return;
    }
    const planned = plannedRaw.trim() ? Number(plannedRaw) : null;
    if (planned !== null && (Number.isNaN(planned) || planned < 1)) {
      return;
    }
    const groupsNum = groups.trim() ? Number(groups) : null;
    const strataNum = strata.trim() ? Number(strata) : null;
    mutation.mutate({
      analysisType,
      effectSize: effect,
      alpha: Number(alpha),
      power: Number(power),
      groups: analysisType === "anova" ? groupsNum : null,
      strata: analysisType === "stratified" ? strataNum : null,
      plannedN: planned,
    });
  };

  const data = mutation.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          样本量规划
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          按分析类型与效应量计算所需样本量，给出回收目标（公式计算，免费）。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 参数区 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-900">分析类型</label>
            <Select
              value={analysisType}
              onValueChange={(v) => setAnalysisType(v as AnalysisType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYSIS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-900">
              效应量（留空自动）
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={analysisType === "correlation" ? "0.99" : undefined}
              placeholder={EFFECT_PLACEHOLDER[analysisType]}
              value={effectSize}
              onChange={(e) => setEffectSize(e.target.value)}
            />
          </div>

          {/* ANOVA 组数（仅 ANOVA 显示） */}
          {analysisType === "anova" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-900">组数</label>
              <Input
                type="number"
                min="2"
                placeholder="如 3"
                value={groups}
                onChange={(e) => setGroups(e.target.value)}
              />
            </div>
          )}

          {/* 分层抽样层数（仅分层显示） */}
          {analysisType === "stratified" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-900">分层数</label>
              <Input
                type="number"
                min="1"
                placeholder="如 2"
                value={strata}
                onChange={(e) => setStrata(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-900">
              显著性水平 α
            </label>
            <Select value={alpha} onValueChange={setAlpha}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALPHA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-900">检验功效</label>
            <Select value={power} onValueChange={setPower}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POWER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-ink-900">
              计划回收样本量（可选，用于达标判定）
            </label>
            <Input
              type="number"
              min="1"
              placeholder="如 200"
              value={plannedN}
              onChange={(e) => setPlannedN(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button
            size="sm"
            onClick={() => runPlan()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "计算中..." : "计算"}
            {!mutation.isPending && <RotateCcw className="ml-1.5 h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* 结果区 */}
        {mutation.isError && (
          <p className="text-xs text-error">
            计算失败：{mutation.error.message}
          </p>
        )}

        {data && (
          <div className="space-y-3">
            {/* 回收目标 */}
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <div className="text-xs text-muted-foreground">建议回收目标</div>
                <div className="text-3xl font-bold text-primary">
                  N = {data.recommendedN}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {data.analysisLabel} · α={data.alpha} · 功效 {Math.round(data.power * 100)}%
                  · {SOURCE_LABEL[data.effectSource] ?? ""}（{data.effectLabel}）
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>公式所需 N={data.requiredN}</div>
                {data.perGroupN && <div>每组 n={data.perGroupN}</div>}
                <div>代表性下限 N={data.representativeMin}</div>
              </div>
            </div>

            {/* 判定 */}
            {data.plannedN !== null && (
              <div
                className={`flex items-center gap-2 rounded-md border p-3 ${
                  VERDICT_CONFIG[data.verdict].cls
                }`}
              >
                {(() => {
                  const VerdictIcon = VERDICT_CONFIG[data.verdict].Icon;
                  return <VerdictIcon className="h-4 w-4 shrink-0" />;
                })()}
                <span className="text-sm font-medium">
                  计划回收 N={data.plannedN}：{data.verdictLabel}
                </span>
                {data.shortfall > 0 && (
                  <Badge variant="outline" className="ml-auto font-normal">
                    还差 {data.shortfall} 份
                  </Badge>
                )}
              </div>
            )}

            {/* 说人话建议 */}
            <div className="space-y-2">
              {data.guidance.map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>

            {data.oneLiner && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="text-sm text-ink-800">{data.oneLiner}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
