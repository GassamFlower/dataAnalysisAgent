"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles, ShoppingBag, UserCheck, Rocket, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ContactForm } from "@/components/contact/contact-form";
import { WechatEntry } from "@/components/contact/wechat-entry";
import { PRICING, SIMULATED_WATERMARK } from "@/lib/constants";
import { SITE } from "@/lib/site-config";

const PLAN_ORDER: Array<keyof typeof PRICING> = ["free", "single", "report", "subscription"];

const steps = [
  {
    icon: ShoppingBag,
    title: "小红书下单",
    desc: `搜索「${SITE.xhsShopName}」进店，选择对应服务包下单。`,
  },
  {
    icon: UserCheck,
    title: "客服核对开通",
    desc: "把订单号发给店铺客服，核对后为你开通对应套餐。",
  },
  {
    icon: Rocket,
    title: "登录使用",
    desc: "用注册邮箱登录，套餐状态可在设置页查看。",
  },
];

const faqs = [
  {
    q: "下单后多久能开通？",
    a: "客服核对订单后一般在 1 个工作日内开通。开通后登录账号即可看到套餐状态，无需在站内再次付款。",
  },
  {
    q: "免费体检包含什么？",
    a: "题目上传与解析、维度归属推断、题型与反向题识别、样本代表性诊断。这部分永久免费，不需要下单。",
  },
  {
    q: "单次预演和完整报告有什么区别？",
    a: "单次预演包含基础模拟、标准统计与导出；完整报告额外包含 AI 诊断结论、全格式导出、样本量规划、报告润色。只有一份问卷时选完整报告即可。",
  },
  {
    q: "数据可以用于论文吗？",
    a: `不可以。所有生成数据带「${SIMULATED_WATERMARK}」标识，仅用于研究可行性预演，帮助你在正式收集数据前确认方案可行。`,
  },
  {
    q: "学期包适合什么情况？",
    a: "有多份问卷需要预演，或需要反复调整题目与假设时，学期包在有效期内不限次使用。",
  },
];

export default function PricingPage() {
  const [orderHelpOpen, setOrderHelpOpen] = useState(false);

  const renderOrderAction = (planKey: keyof typeof PRICING, highlighted: boolean) => {
    const plan = PRICING[planKey];

    if (planKey === "free") {
      return (
        <Button size="lg" className="w-full" variant="outline" asChild>
          <Link href="/projects/new">{plan.cta}</Link>
        </Button>
      );
    }

    if (SITE.xhsShopUrl) {
      return (
        <Button
          size="lg"
          className="w-full"
          variant={highlighted ? "default" : "outline"}
          asChild
        >
          <a href={SITE.xhsShopUrl} target="_blank" rel="noopener noreferrer">
            {plan.cta}
            <ExternalLink className="ml-1.5 h-4 w-4" />
          </a>
        </Button>
      );
    }

    return (
      <Button
        size="lg"
        className="w-full"
        variant={highlighted ? "default" : "outline"}
        onClick={() => setOrderHelpOpen(true)}
      >
        {plan.cta}
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="mx-auto max-w-6xl px-6 pb-4 pt-10">
        <section className="text-center">
          <Badge variant="secondary" className="mb-4 font-normal text-ink-500">
            服务包 · 小红书店铺下单
          </Badge>
          <h1 className="text-h1 font-semibold tracking-tight text-ink-900">
            发问卷前先预演，避免白做一趟
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-body text-ink-500">
            题目体检永久免费。数据预演、统计报告、全格式导出等完整能力按服务包开通，
            在小红书店铺下单后由客服为你开通。
          </p>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((key) => {
            const plan = PRICING[key];
            const isHighlighted = key === "report";

            return (
              <Card
                key={key}
                className={`relative flex h-full flex-col p-6 transition-colors ${
                  isHighlighted
                    ? "border-primary/35 bg-brand-soft/60"
                    : "border-border bg-card"
                }`}
              >
                {"badge" in plan && plan.badge && (
                  <Badge
                    className="absolute -top-3 left-6"
                    variant={isHighlighted ? "default" : "secondary"}
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    {plan.badge}
                  </Badge>
                )}

                <h2 className="text-h3 font-semibold text-ink-900">{plan.name}</h2>

                <div className="mt-3 flex items-baseline gap-1">
                  {plan.price === 0 ? (
                    <span className="tabular text-h2 font-semibold text-ink-900">免费</span>
                  ) : (
                    <>
                      <span className="text-small text-ink-500">¥</span>
                      <span className="tabular text-h2 font-semibold text-ink-900">
                        {plan.price}
                      </span>
                    </>
                  )}
                  <span className="text-small text-ink-500">/ {plan.unit}</span>
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-body text-ink-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">{renderOrderAction(key, isHighlighted)}</div>
              </Card>
            );
          })}
        </section>

        <p className="mt-5 text-center text-caption text-ink-400">
          站内价格为参考价，实际价格、优惠与退款规则以小红书订单页为准。站点不提供在线支付。
        </p>

        <section className="mt-16">
          <h2 className="text-center text-h2 font-semibold text-ink-900">开通流程</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-ink-700">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-body-lg font-semibold text-ink-900">
                  {index + 1}. {step.title}
                </h3>
                <p className="mt-1 text-small text-ink-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-h2 font-semibold text-ink-900">常见问题</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {faqs.map((faq) => (
              <Card key={faq.q} className="p-5">
                <h3 className="text-body-lg font-semibold text-ink-900">{faq.q}</h3>
                <p className="mt-2 text-small leading-relaxed text-ink-500">{faq.a}</p>
              </Card>
            ))}
          </div>
        </section>

        <Card className="mt-16 p-8 text-center">
          <h2 className="text-h2 font-semibold text-ink-900">不确定选哪个？</h2>
          <p className="mx-auto mt-2 max-w-xl text-body text-ink-500">
            把你的课题方向、问卷数量和截稿时间告诉客服，我们帮你判断需要哪个服务包。
          </p>
          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-3">
            <WechatEntry trigger={<Button variant="outline" size="lg">加客服微信</Button>} />
            <ContactForm
              defaultTag="presale"
              entryPoint="pricing"
              trigger={<Button variant="outline" size="lg">留言咨询</Button>}
            />
          </div>
        </Card>
      </main>

      <SiteFooter />

      <Dialog open={orderHelpOpen} onOpenChange={setOrderHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>如何在小红书下单</DialogTitle>
            <DialogDescription>
              站点不提供在线支付，套餐通过小红书店铺订单开通。
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-2 space-y-3 text-body text-ink-700">
            <li>1. 打开小红书，搜索店铺「{SITE.xhsShopName}」。</li>
            <li>2. 进入店铺，选择对应的服务包下单。</li>
            <li>3. 把订单号发给店铺客服，客服核对后为你开通。</li>
            <li>4. 回到本站，用注册邮箱登录即可使用。</li>
          </ol>
          <div className="mt-4">
            <ContactForm
              defaultTag="presale"
              entryPoint="pricing-order-help"
              trigger={<Button className="w-full">先把需求发给客服</Button>}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
