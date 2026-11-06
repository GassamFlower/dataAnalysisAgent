import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  FileSearch,
  FlaskConical,
  FileBarChart,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Download,
  GraduationCap,
  Code2,
  ShoppingBag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ReportPreview } from "@/components/marketing/report-preview";
import { DemoSimulation } from "@/components/marketing/demo-simulation";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { PRICING, SIMULATED_WATERMARK } from "@/lib/constants";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "预演 | 发问卷前先预演，回收后看懂样本",
  description:
    "上传问卷题目先做信效度和样本代表性体检，再用一句话描述假设预演数据是否达标。题目体检永久免费，完整报告与导出按服务包开通，小红书店铺下单。",
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
  authors: [{ name: SITE.name }],
  openGraph: {
    title: "预演 | 发问卷前先预演，回收后看懂样本",
    description:
      "回收前预演数据方向，回收后诊断样本代表性。题目体检永久免费，完整能力按服务包开通。",
    type: "website",
    locale: "zh_CN",
    siteName: SITE.name,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "预演 - 发问卷前先预演，回收后看懂样本",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "预演 | 发问卷前先预演，回收后看懂样本",
    description:
      "回收前预演数据方向，回收后诊断样本代表性。题目体检永久免费。",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

const quickSteps = [
  {
    icon: FileSearch,
    title: "上传问卷题目",
    desc: "粘贴题目文本，或导入问卷星与 SPSS 文件。",
  },
  {
    icon: FlaskConical,
    title: "说清研究假设",
    desc: "选维度强度，系统生成相关矩阵并预演数据。",
  },
  {
    icon: FileBarChart,
    title: "拿到预演报告",
    desc: "信效度、差异分析、智能诊断与导出一次完成。",
  },
];

const features = [
  {
    icon: FileSearch,
    title: "题目体检",
    desc: "自动识别题型、维度归属与反向题。永久免费。",
  },
  {
    icon: FlaskConical,
    title: "数据预演",
    desc: "一句话描述假设，生成相关矩阵与模拟数据，透明可编辑。",
  },
  {
    icon: Users,
    title: "样本代表性诊断",
    desc: "样本量够不够、性别分布是否失衡、结构是否集中，给出补收建议。",
  },
  {
    icon: FileBarChart,
    title: "统计报告",
    desc: "信效度检验、差异分析、智能诊断，一键导出 Word / Excel / PDF / PPT。",
  },
  {
    icon: Lightbulb,
    title: "智能诊断",
    desc: "先匹配常见翻车点，再用自然语言说明原因和改法。",
  },
  {
    icon: Download,
    title: "一键导入与导出",
    desc: "问卷星、SPSS 文件直接导入，报告与数据集按需导出。",
  },
];

const painPoints = [
  {
    title: "收不回数据",
    desc: "问卷发出去石沉大海，好不容易收回几十份，样本量不够。",
  },
  {
    title: "信效度不达标",
    desc: "SPSS 一跑 α 系数太低，维度划分有问题，题目设计要重来。",
  },
  {
    title: "样本没代表性",
    desc: "收回来全是同学填的，男女比 8:2、年龄全在 20 岁上下。",
  },
  {
    title: "相关性不显著",
    desc: "假设的关系跑不出来，论文核心结论站不住脚。",
  },
];

const principles = [
  {
    icon: ShieldCheck,
    title: "合规优先",
    desc: "生成数据强制带 SIMULATED 标识，仅用于研究可行性预演。",
  },
  {
    icon: GraduationCap,
    title: "面向本科生",
    desc: "不需要精通统计软件，按步骤就能完成一次完整预演。",
  },
  {
    icon: Code2,
    title: "技术透明",
    desc: "统计阈值公开，效应量档位与学术标准一致。",
  },
];

const trustItems = [
  "回收前预演数据方向",
  "样本代表性诊断",
  "Cronbach's α 信度分析",
  "KMO + Bartlett 效度检验",
  "t检验 / ANOVA / 卡方 / 回归",
  "智能诊断",
  "Word / Excel / PPT / PDF 导出",
  "论文信效度段落自动生成",
];

const faqs = [
  {
    q: "题目体检真的免费吗？",
    a: "是。题目上传、解析、维度归属推断、题型与反向题识别、样本代表性诊断都免费，不需要下单。",
  },
  {
    q: "完整能力怎么开通？",
    a: "在小红书店铺选择服务包下单，把订单号发给客服，核对后为你开通。站点不提供在线支付。",
  },
  {
    q: "生成的数据能写进论文吗？",
    a: "不能。所有生成数据带 SIMULATED 标识，仅用于研究可行性预演，帮助你提前发现题目或假设的问题。",
  },
  {
    q: "统计方法和 SPSS 一致吗？",
    a: "核心方法（α、KMO、Bartlett、t 检验、ANOVA、卡方、回归）与 SPSS 输出一致，差异检验方法由决策树自动选择。",
  },
  {
    q: "需要会统计吗？",
    a: "不需要。按页面步骤操作即可；每个指标旁边都有解释，诊断会直接告诉你下一步改什么。",
  },
  {
    q: "数据安全吗？",
    a: "问卷与生成数据存储在国内服务器。AI 诊断只传输题目与假设文本，不传输邮箱、昵称和密码。",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <MarketingHeader />

      <section className="mx-auto max-w-4xl px-6 pb-8 pt-10 sm:pt-14">
        <Stagger step={0.1} amount={0.3}>
          <StaggerItem>
            <Badge variant="outline" className="mb-4 font-normal text-ink-500">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              题目体检永久免费 · 数据仅用于研究预演
            </Badge>
          </StaggerItem>
          <StaggerItem>
            <h1 className="text-[30px] font-semibold leading-[1.18] tracking-tight text-ink-900 sm:text-[42px]">
              发问卷前先预演
              <br className="sm:hidden" />
              <span className="text-primary">回收后看懂样本</span>
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-4 max-w-2xl text-body-lg leading-relaxed text-ink-500">
              上传题目先做信效度体检，一句话描述假设预演数据是否达标；
              收回问卷后用样本代表性诊断判断样本够不够格。两步都在写结论之前。
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/projects/new">
                  开始免费体检
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
                <Link href="/example">先看样例报告</Link>
              </Button>
            </div>
          </StaggerItem>
        </Stagger>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-4">
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-cream-surface p-4 sm:grid-cols-3 sm:p-5">
          {quickSteps.map((step, index) => (
            <div key={step.title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-card text-ink-700">
                <step.icon className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-body font-semibold text-ink-900">
                  {index + 1}. {step.title}
                </h2>
                <p className="mt-0.5 text-small text-ink-500">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ReportPreview />

      <p className="mx-auto max-w-5xl px-6 pb-2 text-center font-mono text-caption tracking-wider text-ink-400">
        {SIMULATED_WATERMARK}
      </p>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-5 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-h3 font-semibold text-ink-900">免费额度内先把流程跑通</h2>
              <p className="mt-1.5 text-small text-ink-500">
                免费账号可创建 3 个项目，每周 3 次预演与导出。确认好用后再开通服务包。
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild>
                <Link href="/projects/new">免费开始</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/pricing">
                  <ShoppingBag className="mr-1.5 h-4 w-4" />
                  看服务包
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <DemoSimulation />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Reveal className="mb-7">
          <div className="flex items-center gap-2 text-caption font-medium uppercase tracking-[0.14em] text-ink-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            回收前最怕的
          </div>
          <h2 className="mt-2 text-h2 font-semibold leading-snug text-ink-900">
            问卷白做一趟，问题往往出在这几步
          </h2>
        </Reveal>
        <Stagger step={0.06} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {painPoints.map((point, index) => (
            <StaggerItem key={point.title}>
              <Card className="h-full border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-body-lg font-semibold text-ink-900">{point.title}</h3>
                  <span className="text-caption tabular text-ink-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-1.5 text-small leading-relaxed text-ink-500">{point.desc}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Reveal className="mb-7">
          <h2 className="text-h2 font-semibold text-ink-900">一套工具，从题目体检到报告导出</h2>
          <p className="mt-2 text-body text-ink-500">
            每一步都能看见数字是怎么来的，不需要在黑箱里等结果。
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 50}>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-ink-700">
                  <feature.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-body-lg font-semibold text-ink-900">{feature.title}</h3>
                  <p className="mt-0.5 text-small leading-relaxed text-ink-500">
                    {feature.desc}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Reveal>
          <div className="rounded-xl border border-border bg-cream-surface px-6 py-7 sm:px-8">
            <h2 className="text-center text-h2 font-semibold text-ink-900">
              覆盖论文所需全部统计方法
            </h2>
            <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-x-8 gap-y-2.5 text-left sm:grid-cols-2">
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

      <section id="principles" className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {principles.map((item) => (
            <Card key={item.title} className="p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-ink-700">
                <item.icon className="h-4 w-4" />
              </div>
              <h2 className="mt-3 text-body-lg font-semibold text-ink-900">{item.title}</h2>
              <p className="mt-1 text-small leading-relaxed text-ink-500">{item.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Reveal>
          <div className="rounded-xl border border-primary/25 bg-brand-soft/60 p-6 sm:p-8">
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-h2 font-semibold text-ink-900">需要完整报告时再开通</h2>
                <p className="mt-2 text-body text-ink-500">
                  完整报告 {PRICING.report.price} 元/份，学期包 {PRICING.subscription.price} 元。
                  站内价格为参考价，实际以小红书店铺订单页为准。
                </p>
              </div>
              <Button size="lg" className="shrink-0" asChild>
                <Link href="/pricing">
                  查看服务包
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-h2 font-semibold text-ink-900">常见问题</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {faqs.map((faq) => (
            <Card key={faq.q} className="p-5">
              <h3 className="text-body-lg font-semibold text-ink-900">{faq.q}</h3>
              <p className="mt-1.5 text-small leading-relaxed text-ink-500">{faq.a}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12 text-center">
        <h2 className="text-h2 font-semibold text-ink-900">先免费体检，再决定要不要开通</h2>
        <p className="mx-auto mt-2 max-w-xl text-body text-ink-500">
          上传题目就能看到方向是否可行，不需要先付费。
        </p>
        <Button size="lg" className="mt-5" asChild>
          <Link href="/projects/new">
            开始免费体检
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </section>

      <SiteFooter />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex gap-2">
          <Button className="flex-1" asChild>
            <Link href="/projects/new">免费体检</Link>
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/example">看样例报告</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
