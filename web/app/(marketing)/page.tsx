import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  FileSearch,
  FlaskConical,
  Users,
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
import { ReportPreview } from "@/components/marketing/report-preview";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { PROJECT_STEPS, SIMULATED_WATERMARK, DISCLAIMER } from "@/lib/constants";

export const metadata: Metadata = {
  title: "数据分析智能体 | 回收前预演，回收后看懂",
  description:
    "全网唯一支持回收前预演：上传问卷题目先做信效度体检，一句话描述假设预演数据是否达标；回收后用样本代表性诊断看懂样本够不够格——在正式发问卷之前，就知道方向对不对。免费题目体检，付费生成数据与报告。",
  keywords: [
    "数据分析",
    "问卷预演",
    "样本代表性",
    "信效度检验",
    "本科毕设",
    "SPSS",
    "统计预演",
    "Cronbach's α",
    "KMO",
    "数据生成",
  ],
  authors: [{ name: "数据分析智能体团队" }],
  openGraph: {
    title: "数据分析智能体 | 回收前预演，回收后看懂",
    description:
      "回收前预演：先体检题目、预演数据是否达标；回收后看懂：样本代表性诊断帮你判断样本够不够格。",
    type: "website",
    locale: "zh_CN",
    siteName: "数据分析智能体",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "数据分析智能体 - 回收前预演，回收后看懂",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "数据分析智能体 | 回收前预演，回收后看懂",
    description:
      "回收前预演：先体检题目、预演数据是否达标；回收后看懂：样本代表性诊断帮你判断样本够不够格。",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: "/",
  },
};

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
    title: "样本没代表性",
    desc: "收回来全是同学填的，男女比 8:2、年龄全在 20 岁上下，答辩一句话就被问住。",
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
    desc: "一句话描述假设，自动生成相关矩阵与模拟数据，透明可编辑——回收前就知道方向对不对。",
  },
  {
    icon: Users,
    title: "样本代表性诊断",
    desc: "回收后自动体检：样本量够不够、性别分布是否失衡、结构是否集中，给出补收建议。",
  },
  {
    icon: FileBarChart,
    title: "统计报告",
    desc: "信效度检验、差异分析、R4 智能诊断，一键导出 Word / Excel。",
  },
  {
    icon: Lightbulb,
    title: "R4 智能诊断",
    desc: "DeepSeek-R1 推理诊断不达标项，每个问题配一句话告诉你怎么办。",
  },
  {
    icon: Download,
    title: "一键导入与导出",
    desc: "问卷星 / SPSS 文件直接导入，Word / Excel / PPT / PDF 报告导出。",
  },
];

const trustItems = [
  "回收前预演数据方向",
  "样本代表性诊断",
  "Cronbach's α 信度分析",
  "KMO + Bartlett 效度检验",
  "t检验 / ANOVA / 卡方 / 回归",
  "DeepSeek-R1 智能诊断",
  "Word / Excel / PPT 一键导出",
  "论文信效度段落自动生成",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <MarketingHeader />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-12 text-center">
        <Stagger step={0.12} amount={0.3}>
          <StaggerItem>
            <Badge variant="secondary" className="mb-6 font-normal text-ink-500">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              全网唯一支持回收前预演 · 合规路线 · 仅用于研究预演
            </Badge>
          </StaggerItem>
          <StaggerItem>
            <h1 className="font-display text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
              回收前预演，回收后看懂
              <br className="hidden sm:block" />
              <span className="text-primary">避免问卷白做一趟</span>
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mx-auto mt-6 max-w-2xl text-body-lg text-ink-500">
              发问卷之前：先做一次信效度体检，一句话描述假设，预演数据是否达标；
              收问卷之后：用样本代表性诊断看懂样本量、性别分布和结构集中度——
              两条路都在正式写结论之前，就知道方向对不对。
            </p>
          </StaggerItem>
          <StaggerItem>
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
          </StaggerItem>
          <StaggerItem>
            <p className="mt-4 font-mono text-caption tracking-wider text-ink-400">
              {SIMULATED_WATERMARK}
            </p>
          </StaggerItem>
        </Stagger>
      </section>

      {/* 报告预览：首次印象让外行看得懂成品 */}
      <ReportPreview />

      {/* 痛点区 */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <Stagger step={0.07} className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {painPoints.map((p) => (
            <StaggerItem key={p.title}>
              <Card className="h-full border-destructive/20 bg-destructive/5 p-6 transition-shadow duration-base hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-h3 font-semibold text-ink-900">{p.title}</h3>
                <p className="mt-2 text-body text-ink-500">{p.desc}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* 三步流程 */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <Reveal>
          <h2 className="mb-8 text-center text-h2 font-semibold text-ink-900">
            三步完成研究预演
          </h2>
        </Reveal>
        <Stagger step={0.1} className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PROJECT_STEPS.map((step, i) => {
            const Icon = stepIcons[i];
            return (
              <StaggerItem key={step.key}>
                <Card className="h-full p-6 transition-shadow duration-base hover:shadow-md">
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
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      {/* 功能特性区 */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <Reveal>
          <h2 className="mb-8 text-center text-h2 font-semibold text-ink-900">
            核心能力
          </h2>
        </Reveal>
        <Stagger step={0.06} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <Card className="flex h-full items-start gap-4 p-6 transition-shadow duration-base hover:shadow-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-h3 font-semibold text-ink-900">{f.title}</h3>
                  <p className="mt-2 text-body text-ink-500">{f.desc}</p>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* 信任背书区 */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <Reveal>
          <Card className="bg-cream-surface p-8 transition-shadow duration-base hover:shadow-md">
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
        </Reveal>
      </section>

      {/* 定价引导 */}
      <section className="mx-auto max-w-5xl px-6 py-12 text-center">
        <h2 className="text-h2 font-semibold text-ink-900">
          免费体检，付费预演
        </h2>
        <p className="mt-2 text-body text-ink-500">
          题目体检与样本代表性诊断永久免费，确认可行后再付费生成数据与报告。
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
