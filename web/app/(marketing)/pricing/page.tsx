"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { ContactForm } from "@/components/contact/contact-form";
import { WechatEntry } from "@/components/contact/wechat-entry";
import { SIMULATED_WATERMARK, DISCLAIMER } from "@/lib/constants";

/**
 * 服务与咨询页。
 *
 * 说明（线下成交转最小可行方案，Step 1）：
 * - 不再展示三层价格与在线支付 CTA（9.9 / 19.9 / single / subscription 均不出现对外）。
 * - 作为「免费试用 + 联系客服」枢纽：免费体验入口 + 客服微信一键加 + 留言告知需求。
 * - 完整能力的开通走线下渠道，由客服引导、管理员在后台开通，本站不承载在线成交。
 */
export default function ServiceConsultPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* 免费试用引导 */}
        <section className="rounded-lg border border-border bg-card p-8 text-center">
          <Badge variant="secondary" className="mb-4 font-normal text-ink-500">
            免费试用 · 体检永久免费
          </Badge>
          <h1 className="text-h2 font-semibold text-ink-900">
            先免费体检，确认可行再开通完整能力
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-body text-ink-500">
            题目体检、维度归属推断、题型/反向题识别永久免费；
            数据预演、统计报告、智能诊断与导出等完整能力，开通方式请直接联系客服。
          </p>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/projects/new">开始免费体检</Link>
            </Button>
            <WechatEntry
              trigger={<Button variant="outline" size="lg">一键加客服微信</Button>}
            />
            <ContactForm
              defaultTag="presale"
              entryPoint="pricing"
              trigger={<Button variant="outline" size="lg">留言告知需求</Button>}
            />
          </div>
        </section>

        {/* 开通流程说明 */}
        <section className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card className="lift h-full p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              ①
            </div>
            <h3 className="mt-4 text-h3 font-semibold text-ink-900">先免费体检</h3>
            <p className="mt-2 text-body text-ink-500">
              上传问卷题目，免费确认「题目设计 + 假设方向」是否可行。
            </p>
          </Card>
          <Card className="lift h-full p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              ②
            </div>
            <h3 className="mt-4 text-h3 font-semibold text-ink-900">联系客服</h3>
            <p className="mt-2 text-body text-ink-500">
              一键加客服二维码或留言说明课题，客服会帮你判断方案并告知完整能力的开通方式。
            </p>
          </Card>
          <Card className="lift h-full p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              ③
            </div>
            <h3 className="mt-4 text-h3 font-semibold text-ink-900">开通完整能力</h3>
            <p className="mt-2 text-body text-ink-500">
              由客服/后台管理员为你开通数据预演、报告导出等完整能力。
            </p>
          </Card>
        </section>

        {/* 常见问题 */}
        <section className="mt-16">
          <h2 className="text-h2 font-semibold text-ink-900">常见问题</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-medium text-ink-900">免费体检包含什么？</h4>
              <p className="mt-2 text-body text-ink-500">
                题目上传与解析、维度归属推断、题型与反向题识别。可确认题目是否可行。
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-medium text-ink-900">完整能力怎么开通？</h4>
              <p className="mt-2 text-body text-ink-500">
                扫码/留言联系客服，客服会为你确认需求并指引开通流程，无需在线自助下单操作。
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-medium text-ink-900">数据可以用于论文吗？</h4>
              <p className="mt-2 text-body text-ink-500">
                不可以。所有数据强制带 {SIMULATED_WATERMARK} 水印，仅用于研究可行性预演。
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-medium text-ink-900">不达标怎么办？</h4>
              <p className="mt-2 text-body text-ink-500">
                智能诊断会给出逐项修改建议，调整题目或假设后重新体检与预演。
              </p>
            </div>
          </div>
        </section>

        {/* 联系引导 */}
        <section className="mt-16 rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-h2 font-semibold text-ink-900">需要完整能力？直接联系客服</h2>
          <p className="mx-auto mt-2 max-w-xl text-body text-ink-500">
            不确定该不该、要不要开通？让客服帮你判断方案是否适合你的课题。
          </p>
          <div className="mt-5 inline-flex items-center gap-3">
            <WechatEntry
              trigger={<Button size="lg">一键加客服微信</Button>}
            />
            <ContactForm
              defaultTag="presale"
              entryPoint="pricing"
              trigger={<Button variant="outline" size="lg">留言咨询</Button>}
            />
          </div>
        </section>

        <p className="mt-10 text-center text-caption text-ink-400">{DISCLAIMER}</p>
      </main>
    </div>
  );
}