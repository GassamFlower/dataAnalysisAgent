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
import { DemoSimulation } from "@/components/marketing/demo-simulation";
import { ContactForm } from "@/components/contact/contact-form";
import { WechatEntry } from "@/components/contact/wechat-entry";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { PROJECT_STEPS, SIMULATED_WATERMARK, DISCLAIMER } from "@/lib/constants";

export const metadata: Metadata = {
  title: "数据分析智能体 | 回收前预演，回收后看懂",
  description:
    "全网唯一支持回收前预演：上传问卷题目先做信效度体检，一句话描述假设预演数据是否达标；回收后用样本代表性诊断看懂样本够不够格——在正式发问卷之前，就知道方向对不对。免费题目体检，完整能力联系客服开通。",
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
    desc: "信效度检验、差异分析、智能诊断，一键导出 Word / Excel。",
  },
  {
    icon: Lightbulb,
    title: "智能诊断",
    desc: "AI 推理诊断不达标项，每个问题配一句话告诉你怎么办。",
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
  "智能诊断",
  "Word / Excel / PPT 一键导出",
  "论文信效度段落自动生成",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <MarketingHeader />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-20 text-center">
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
                <Link href="/pricing">联系客服</Link>
              </Button>
            </div>
          </StaggerItem>
        </Stagger>
      </section>

      {/* 报告预览：首次印象让外行看得懂成品 */}
      <ReportPreview />

      {/* 可交互预演 demo：拖动效应量/样本量 → 命中率实时变化 */}
      <DemoSimulation />

      {/* 预演数据水印脚注 */}
      <p className="mx-auto max-w-5xl px-6 pb-2 text-center font-mono text-caption tracking-wider text-ink-400">
        {SIMULATED_WATERMARK}
      </p>

      {/* 痛点区（editorial：标题左对齐 + 不对称 2+2，破除 4 等分平铺） */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <div>
              <div className="flex items-center gap-2 text-caption font-medium uppercase tracking-[0.14em] text-ink-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                回收前最怕的
              </div>
              <h2 className="mt-3 font-display text-h2 font-semibold leading-snug text-ink-900">
                问卷白做一趟，
                <br />
                问题往往出在这几步
              </h2>
              <p className="mt-4 max-w-[30ch] text-body text-ink-500">
                数据没回收之前，方向是否可行其实已经可以预演——别等发完问卷、跑完 SPSS 才发现。
              </p>
            </div>
          </Reveal>
          <Stagger step={0.08} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {painPoints.map((p, i) => (
              <StaggerItem key={p.title}>
                <Card className="lift h-full border-border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <p.icon className="h-5 w-5" />
                    </div>
                    <span className="font-display text-caption text-ink-400 tabular">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-3 text-h3 font-semibold text-ink-900">{p.title}</h3>
                  <p className="mt-1.5 text-body text-ink-500">{p.desc}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 四步流程（大衬线序号打破平铺；sm 两列 lg 四列完整展示） */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <Reveal className="mb-8">
          <h2 className="font-display text-h2 font-semibold leading-snug text-ink-900">
            四条路径，闭环一次研究预演
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROJECT_STEPS.map((step, i) => {
            const Icon = stepIcons[i];
            return (
              <Reveal key={step.key} delay={i * 80}>
                <div className="relative h-full overflow-hidden rounded-lg border border-border bg-card p-6">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-1 top-1 select-none font-display text-[5rem] font-bold leading-none text-ink-900/5"
                  >
                    {i + 1}
                  </span>
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-h3 font-semibold text-ink-900">{step.label}</h3>
                    <p className="mt-2 text-body text-ink-500">{step.description}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* 功能特性区（editorial 头 + 双列清单，区别于前两区） */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-[1fr_2fr]">
          <Reveal>
            <div>
              <div className="text-caption font-medium uppercase tracking-[0.14em] text-ink-400">
                核心能力
              </div>
              <h2 className="mt-3 font-display text-h2 font-semibold leading-snug text-ink-900">
                一套工具，
                <br />
                从题目体检到论文报告
              </h2>
              <Button variant="outline" size="sm" className="mt-6" asChild>
                <Link href="/learn">先学统计知识
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-h3 font-semibold text-ink-900">{f.title}</h3>
                    <p className="mt-1 text-body text-ink-500">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 覆盖能力带（信息密集：文本分栏而非整卡，制造密集-放松交替） */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <Reveal>
          <div className="rounded-lg border border-border bg-cream-surface px-6 py-8 sm:px-8">
            <h2 className="text-center font-display text-h2 font-semibold text-ink-900">
              覆盖论文所需全部统计方法
            </h2>
            <div className="mx-auto mt-7 grid max-w-3xl grid-cols-1 gap-x-8 gap-y-2.5 text-left sm:grid-cols-2">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  <span className="text-body text-ink-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* 开通收口 CTA */}
      <section className="mx-auto max-w-5xl px-6 pt-16 text-center">
        <Reveal>
          <h2 className="font-display text-h2 font-semibold leading-snug text-ink-900">
            免费体检，开通完整能力找客服
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-body text-ink-500">
            题目体检与样本代表性诊断永久免费；数据预演、统计报告、智能诊断与导出等完整能力，联系客服即可开通。
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/pricing">
                联系客服
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/projects/new">
                开始免费体检
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* 页脚 */}
      <footer className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-caption text-ink-500">
          {DISCLAIMER}
        </div>
        <div className="mt-6 flex items-center justify-center gap-4 text-caption text-ink-400">
          <Link href="/" className="hover:text-ink-700">首页</Link>
          <span>·</span>
          <Link href="/pricing" className="hover:text-ink-700">联系</Link>
          <span>·</span>
          <Link href="/about" className="hover:text-ink-700">关于</Link>
          <span>·</span>
          <WechatEntry
            trigger={
              <span className="cursor-pointer select-none hover:text-ink-700">
                客服微信
              </span>
            }
          />
          <span>·</span>
          <ContactForm
            variant="sheet"
            entryPoint="footer"
            trigger={
              <span className="cursor-pointer select-none hover:text-ink-700">
                留言反馈
              </span>
            }
          />
        </div>
        <p className="mt-4 text-center text-caption text-ink-400">
          数据分析智能体 · 本科毕设研究预演工具
        </p>
      </footer>
    </div>
  );
}
