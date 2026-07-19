import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  FlaskConical,
  FileBarChart,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { PROJECT_STEPS, SIMULATED_WATERMARK, DISCLAIMER } from "@/lib/constants";

const stepIcons = [FileSearch, FlaskConical, FileBarChart, Download];

const painPoints = [
  {
    icon: AlertTriangle,
    title: "收不回数据",
    desc: "问卷发出去石沉大海，好不容易收回几十份，样本量不够。",
  },
  {
    icon: AlertTriangle,
    title: "信效度不达标",
    desc: "SPSS 一跑 α 系数太低，维度划分有问题，题目设计要重来。",
  },
  {
    icon: AlertTriangle,
    title: "相关性不显著",
    desc: "假设的关系跑不出来，论文核心结论站不住脚。",
  },
];

const features = [
  {
    icon: FileSearch,
    title: "题目体检",
    desc: "上传问卷文本，自动识别题型、维度归属与反向题。永久免费。",
  },
  {
    icon: FlaskConical,
    title: "数据预演",
    desc: "一句话描述假设，自动生成相关矩阵与模拟数据，透明可编辑。",
  },
  {
    icon: FileBarChart,
    title: "统计报告",
    desc: "信效度检验、差异分析、R4 智能诊断，一键导出 Word / Excel。",
  },
  {
    icon: Lightbulb,
    title: "R4 智能诊断",
    desc: "DeepSeek-R1 推理诊断不达标项，给出可执行的修改建议。",
  },
];

const trustItems = [
  "Cronbach's α 信度分析",
  "KMO + Bartlett 效度检验",
  "t检验 / ANOVA / 卡方 / 回归",
  "DeepSeek-R1 智能诊断",
  "Word / Excel 一键导出",
  "论文信效度段落自动生成",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <MarketingHeader />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-12 text-center">
        <Badge variant="secondary" className="mb-6 font-normal text-ink-500">
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
          合规路线 · 仅用于研究预演
        </Badge>
        <h1 className="font-display text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
          提前模拟数据方向，
          <br className="hidden sm:block" />
          <span className="text-primary">避免问卷白做一趟</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-body-lg text-ink-500">
          上传问卷题目，先做一次信效度体检；再用一句话描述假设，
          预演数据是否达标——在正式发问卷之前，就知道方向对不对。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/projects/new">
              开始免费体检
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/pricing">查看定价</Link>
          </Button>
        </div>
        <p className="mt-4 font-mono text-caption tracking-wider text-ink-400">
          {SIMULATED_WATERMARK}
        </p>
      </section>

      {/* 痛点区 */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {painPoints.map((p) => (
            <Card key={p.title} className="border-destructive/20 bg-destructive/5 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-h3 font-semibold text-ink-900">{p.title}</h3>
              <p className="mt-2 text-body text-ink-500">{p.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 三步流程 */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-8 text-center text-h2 font-semibold text-ink-900">
          三步完成研究预演
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PROJECT_STEPS.map((step, i) => {
            const Icon = stepIcons[i];
            return (
              <Card key={step.key} className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-caption font-medium text-ink-400">
                  步骤 {i + 1}
                </div>
                <h3 className="mt-1 text-h3 font-semibold text-ink-900">
                  {step.label}
                </h3>
                <p className="mt-2 text-body text-ink-500">{step.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 功能特性区 */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-8 text-center text-h2 font-semibold text-ink-900">
          核心能力
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <Card key={f.title} className="flex items-start gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-h3 font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-2 text-body text-ink-500">{f.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 信任背书区 */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <Card className="bg-cream-surface p-8">
          <h2 className="text-center text-h2 font-semibold text-ink-900">
            覆盖论文所需全部统计方法
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trustItems.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <span className="text-body text-ink-700">{item}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* 定价引导 */}
      <section className="mx-auto max-w-5xl px-6 py-12 text-center">
        <h2 className="text-h2 font-semibold text-ink-900">
          免费体检，付费预演
        </h2>
        <p className="mt-2 text-body text-ink-500">
          题目体检永久免费，确认可行后再付费生成数据与报告。
        </p>
        <Button size="lg" className="mt-6" asChild>
          <Link href="/pricing">
            查看完整定价
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* 页脚 */}
      <footer className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-caption text-ink-500">
          {DISCLAIMER}
        </div>
        <div className="mt-6 flex items-center justify-center gap-4 text-caption text-ink-400">
          <Link href="/" className="hover:text-ink-700">首页</Link>
          <span>·</span>
          <Link href="/pricing" className="hover:text-ink-700">定价</Link>
          <span>·</span>
          <Link href="/about" className="hover:text-ink-700">关于</Link>
        </div>
        <p className="mt-4 text-center text-caption text-ink-400">
          数据分析智能体 · 本科毕设研究预演工具
        </p>
      </footer>
    </div>
  );
}
