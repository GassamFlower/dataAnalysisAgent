"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TestType = "correlation" | "t_test" | "group";

const TEST_OPTIONS: { value: TestType; label: string }[] = [
  { value: "correlation", label: "Pearson 相关" },
  { value: "t_test", label: "独立样本 t 检验" },
  { value: "group", label: "方差分析（等组）" },
];

/**
 * 标准正态分布分位数（累积概率 → 临界值 z）。
 * 常见值查表近似，足够用于样本量估算的精度，避免引入统计库体积。
 */
function znorm(cumulativeP: number): number {
  const table: [number, number][] = [
    [0.9995, 3.29],
    [0.999, 3.09],
    [0.99, 2.326],
    [0.975, 1.96],
    [0.95, 1.645],
    [0.90, 1.282],
    [0.80, 0.842],
    [0.70, 0.524],
    [0.50, 0],
  ];
  for (const [p, z] of table) {
    if (cumulativeP >= p) return z;
  }
  return -3.29;
}

/** 估算样本量；返回 { n, perGroup, label } */
function estimateSampleSize(
  test: TestType,
  alpha: number,
  power: number,
  effect: number,
  groups: number,
): { n: number; label: string } {
  const zCrit = znorm(1 - alpha / 2); // 双侧
  const zPower = znorm(power);

  if (test === "correlation") {
    // n ≈ (z_α/2 + z_β)² / arctanh(r)² + 3
    const r = Math.min(Math.max(Math.abs(effect), 0.01), 0.99);
    const za = Math.atanh(r);
    const n = Math.ceil(((zCrit + zPower) / za) ** 2 + 3);
    return { n, label: `所需有效样本 ≈ ${n} 份` };
  }

  if (test === "t_test") {
    // 两组独立 t：每组 n = 2 * (z_α/2 + z_β)² / d²
    const d = Math.max(Math.abs(effect), 0.01);
    const perGroup = Math.ceil((2 * (zCrit + zPower) ** 2) / d ** 2);
    return {
      n: perGroup * 2,
      label: `每组 ${perGroup} 人，两组共 ${perGroup * 2} 人`,
    };
  }

  // 方差分析（等组，k 组）按 Cohen's f 近似
  const f = Math.max(Math.abs(effect), 0.01);
  const k = Math.max(2, Math.round(groups) || 3);
  const perGroup = Math.ceil(((2 * (zCrit + zPower) ** 2) / f ** 2) / k);
  return {
    n: perGroup * k,
    label: `${k} 组，每组约 ${perGroup} 人，总计约 ${perGroup * k} 人`,
  };
}

/** 各检验的效应量参考阈值 */
const EFFECT_HINT: Record<string, string> = {
  correlation: "输入相关系数 r（0.1 弱 / 0.3 中 / 0.5 强）",
  t_test: "输入 Cohen's d（0.2 小 / 0.5 中 / 0.8 大）",
  group: "输入 Cohen's f（0.10 小 / 0.25 中 / 0.40 大）",
};

/**
 * 样本量计算器（免费引流工具）。
 * 支持 Pearson 相关、独立样本 t、方差分析三种常见场景的样本量估算。
 */
export function SampleSizeCalculator() {
  const [test, setTest] = useState<TestType>("t_test");
  const [alphaText, setAlphaText] = useState("0.05");
  const [powerText, setPowerText] = useState("0.80");
  const [effectText, setEffectText] = useState("0.5");
  const [groupsText, setGroupsText] = useState("3");

  const result = useMemo(() => {
    const alpha = Number(alphaText);
    const power = Number(powerText);
    const effect = Number(effectText);
    const groups = Number(groupsText);
    if (
      Number.isNaN(alpha) || Number.isNaN(power) || Number.isNaN(effect) ||
      alpha <= 0 || alpha >= 1 || power <= 0 || power >= 1 || effect <= 0
    ) {
      return null;
    }
    if (test === "group" && (Number.isNaN(groups) || groups < 2)) {
      return null;
    }
    return estimateSampleSize(test, alpha, power, effect, groups);
  }, [test, alphaText, powerText, effectText, groupsText]);

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">样本量计算器</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          输入显著性水平、统计功效与预期效应量，估算所需有效样本量。
          （本科论文经验值：α=0.05、Power=0.80、选用“中等效应”。）
        </p>

        {/* 检验类型 */}
        <div className="space-y-2">
          <Label>检验类型</Label>
          <Select value={test} onValueChange={(v) => setTest(v as TestType)}>
            <SelectTrigger>
              <SelectValue placeholder="选择检验类型" />
            </SelectTrigger>
            <SelectContent>
              {TEST_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>显著性水平 α</Label>
            <Input
              type="number"
              step="0.01"
              value={alphaText}
              onChange={(e) => setAlphaText(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>统计功效 Power</Label>
            <Input
              type="number"
              step="0.05"
              value={powerText}
              onChange={(e) => setPowerText(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>预期效应量</Label>
            <Input
              type="number"
              step="0.05"
              value={effectText}
              onChange={(e) => setEffectText(e.target.value)}
            />
            <p className="text-caption text-ink-400">{EFFECT_HINT[test]}</p>
          </div>
        </div>

        {test === "group" && (
          <div className="space-y-2">
            <Label>组数</Label>
            <Input
              type="number"
              min={2}
              value={groupsText}
              onChange={(e) => setGroupsText(e.target.value)}
            />
          </div>
        )}

        {/* 结果 */}
        <div className="rounded-lg border bg-cream-surface/50 p-4">
          {result ? (
            <p className="text-base font-medium text-ink-900">{result.label}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              请输入有效数值（α、Power、效应量 &gt; 0）后查看估算结果。
            </p>
          )}
          <p className="mt-1 text-xs text-ink-400">
            注：估算为近似值。若考虑缺失/无效问卷（回收率约 30%~60%），实际发放量应显著放大。
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link href="/learn/sample-size-power">
            去小课堂了解样本量与统计功效
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}