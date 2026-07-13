import Link from "next/link";
import { ArrowRight, ShieldCheck, Code2, GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/page-header";
import { DISCLAIMER } from "@/lib/constants";

export const metadata = { title: "关于" };

const values = [
  {
    icon: ShieldCheck,
    title: "合规优先",
    desc: "所有生成数据强制带 SIMULATED 水印，仅用于研究可行性预演，不可直接用于论文或正式研究。",
  },
  {
    icon: GraduationCap,
    title: "面向本科生",
    desc: "专为本科毕设场景设计，降低统计软件使用门槛，不需要精通 SPSS 也能完成预演。",
  },
  {
    icon: Code2,
    title: "技术透明",
    desc: "统计阈值公开对齐学术标准，效应量档位与 Cohen 国际标准一致，不做黑箱。",
  },
];

const faqs = [
  {
    q: "这个工具是做什么的？",
    a: "数据分析智能体是一个面向本科毕设生的研究预演工具。上传问卷题目后，系统自动体检信效度，再用一句话描述假设即可生成模拟数据，验证研究假设是否成立——在正式发问卷前就知道方向对不对。",
  },
  {
    q: "生成的数据可以直接用在论文里吗？",
    a: "不可以。所有数据强制带 SIMULATED 水印，仅用于研究可行性预演。工具的目的是帮你提前发现题目设计或假设方向的问题，避免正式发问卷后才发现白做一趟。",
  },
  {
    q: "统计方法和 SPSS 一样吗？",
    a: "核心统计方法（Cronbach's α、KMO、Bartlett、t检验、ANOVA、卡方、回归）与 SPSS 输出一致，统计阈值对齐学术标准。差异检验方法由决策树自动选择，无需手动判断。",
  },
  {
    q: "R4 智能诊断是什么？",
    a: "R4 是基于规则的翻车点匹配 + DeepSeek-R1 自然语言推理的诊断系统。先确定性地匹配常见统计翻车点（如 α 过低、样本量不足），再由 LLM 补充自然语言原因和修改建议。",
  },
  {
    q: "免费版和付费版的区别？",
    a: "免费版永久可用，包含题目上传、维度归属推断、题型与反向题识别。付费版解锁数据生成、统计报告、R4 诊断和导出功能。详见定价页。",
  },
  {
    q: "数据安全吗？",
    a: "问卷题目和生成数据存储在本地数据库，不对外公开。LLM 诊断仅传输假设文本，不传输用户身份信息。",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-display text-xl font-bold text-ink-900">
          预演
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">返回首页</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          title="关于数据分析智能体"
          description="一个帮助本科毕设生提前验证研究可行性的预演工具。"
        />

        {/* 产品定位 */}
        <section className="mb-12">
          <Card className="bg-cream-surface p-8">
            <Badge variant="secondary" className="mb-4 font-normal text-ink-500">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              合规路线 · 研究预演
            </Badge>
            <h2 className="text-h2 font-semibold text-ink-900">
              在发问卷之前，就知道方向对不对
            </h2>
            <p className="mt-4 text-body-lg text-ink-600">
              本科毕设最怕的是：问卷发出去收不回数据，好不容易收回来却发现信效度不达标、
              假设的关系跑不出来。数据分析智能体让你在正式发问卷前，
              先用模拟数据做一次"预演"，提前发现问题、调整方向。
            </p>
            <div className="mt-6">
              <Button asChild>
                <Link href="/projects/new">
                  开始免费体检
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </section>

        {/* 核心价值观 */}
        <section className="mb-12">
          <h2 className="mb-6 text-h2 font-semibold text-ink-900">产品原则</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {values.map((v) => (
              <Card key={v.title} className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-h3 font-semibold text-ink-900">{v.title}</h3>
                <p className="mt-2 text-body text-ink-500">{v.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="mb-6 text-h2 font-semibold text-ink-900">常见问题</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {faqs.map((faq) => (
              <Card key={faq.q} className="p-5">
                <h4 className="font-medium text-ink-900">{faq.q}</h4>
                <p className="mt-2 text-body text-ink-500">{faq.a}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* 免责声明 */}
        <section>
          <Card className="border-warning/30 bg-warning/5 p-6">
            <h3 className="text-h3 font-semibold text-ink-900">免责声明</h3>
            <p className="mt-2 text-body text-ink-600">{DISCLAIMER}</p>
          </Card>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center justify-center gap-4 text-caption text-ink-400">
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
