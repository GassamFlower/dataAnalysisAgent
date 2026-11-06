import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ReportPreview } from "@/components/marketing/report-preview";

export const metadata: Metadata = {
  title: "样例报告 | 预演研究预演工作台",
  description:
    "查看预演报告的结构与内容：总体概览、各维度信效度、差异分析、智能诊断。示例数字仅作展示。",
  alternates: { canonical: "/example" },
  openGraph: {
    title: "样例报告 · 预演研究预演工作台",
    description: "先看成品，再决定要不要开通。示例数字仅作展示。",
  },
};

const reportParts = [
  "总体概览：平均 α、达标维度、建议样本量",
  "各维度信效度：α、KMO、Bartlett 与达标标记",
  "差异分析：t 检验、ANOVA、卡方自动选择",
  "智能诊断：不达标项的原因与一句改法",
  "样本代表性：样本量、性别分布、结构集中度",
  "导出：Word / Excel / PDF / PPT",
];

export default function ExamplePage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="mx-auto max-w-5xl px-6 pt-10">
        <section className="text-center">
          <Badge variant="outline" className="mb-4 font-normal text-ink-500">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            示例数字 · 仅作展示
          </Badge>
          <h1 className="text-balance text-h1 font-semibold tracking-tight text-ink-900">
            先看成品，再决定要不要开通
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-body text-ink-500">
            下面是一份完整的预演报告样张，结构与正式报告一致。
            数字为示例值，用来说明你会在哪个位置看到什么结论。
          </p>
        </section>

        <section className="mt-8">
          <Card className="p-5 sm:p-6">
            <h2 className="text-h3 font-semibold text-ink-900">报告里有什么</h2>
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {reportParts.map((part) => (
                <div key={part} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span className="text-body text-ink-700">{part}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <ReportPreview />

        <section className="pb-10 text-center">
          <h2 className="text-h2 font-semibold text-ink-900">用你自己的问卷跑一份</h2>
          <p className="mx-auto mt-2 max-w-xl text-body text-ink-500">
            题目体检永久免费，先确认方向是否可行，再决定是否开通完整报告。
          </p>
          <Button size="lg" className="mt-5" asChild>
            <Link href="/projects/new">
              开始免费体检
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
