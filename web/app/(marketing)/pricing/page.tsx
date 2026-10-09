"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { Check, Sparkles, Loader2, MessageCircle, Wallet, Upload, MousePointerClick, QrCode, Rocket } from "lucide-react";

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
import { ContactForm } from "@/components/contact/contact-form";
import { WechatEntry } from "@/components/contact/wechat-entry";
import { PRICING, DISCLAIMER, SIMULATED_WATERMARK } from "@/lib/constants";
import { useWechatPayQr } from "@/lib/hooks/use-wechat-pay";
import { useAlipayQr } from "@/lib/hooks/use-alipay";
import { WechatPayQrModal } from "@/components/payment/wechat-pay-modal";
import { AlipayQrModal } from "@/components/payment/alipay-modal";
import type { OrderType } from "@/types/payment";

type PaymentMethod = "wechat" | "alipay";

const PLAN_ORDER: Array<keyof typeof PRICING> = ["free", "single", "report", "subscription"];

function PricingContent() {
  const [payingPlan, setPayingPlan] = useState<OrderType | null>(null);
  const [showMethodDialog, setShowMethodDialog] = useState(false);

  const wechatPay = useWechatPayQr();
  const alipay = useAlipayQr();

  const handlePayClick = (planType: OrderType) => {
    setPayingPlan(planType);
    setShowMethodDialog(true);
  };

  const handleMethodSelect = async (method: PaymentMethod) => {
    if (!payingPlan) return;
    setShowMethodDialog(false);
    try {
      if (method === "wechat") {
        await wechatPay.startPay(payingPlan);
      } else {
        await alipay.startPay(payingPlan);
      }
    } catch {
      // hook 内部已处理清理
    }
    setPayingPlan(null);
  };

  const isPending = wechatPay.isPending || alipay.isPending;
  const isQrOpen = wechatPay.qrState.open || alipay.qrState.open;
  const payError = wechatPay.error || alipay.error;

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Hero */}
        <section className="text-center">
          <Badge variant="secondary" className="mb-4 font-normal text-ink-500">
            自助开通 · 扫码即用
          </Badge>
          <h1 className="text-h1 font-bold text-ink-900">
            发问卷前先预演，避免白做一趟
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-body text-ink-500">
            题目体检永久免费。数据预演、统计报告、全格式导出等完整能力，
            选择适合你的方案，微信扫码即开。
          </p>
        </section>

        {/* Pricing Cards */}
        <section className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((key) => {
            const plan = PRICING[key];
            const isHighlighted = key === "report";
            const isFree = key === "free";

            return (
              <Card
                key={key}
                className={`lift relative flex h-full flex-col p-6 transition-shadow ${
                  isHighlighted
                    ? "border-primary bg-primary/5 shadow-lg ring-1 ring-primary lg:scale-[1.03]"
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

                <h3 className="text-h3 font-semibold text-ink-900">{plan.name}</h3>

                <div className="mt-3 flex items-baseline gap-1">
                  {plan.price === 0 ? (
                    <span className="text-h2 font-bold text-ink-900">免费</span>
                  ) : (
                    <>
                      <span className="text-small text-ink-500">¥</span>
                      <span className="text-h2 font-bold text-ink-900">{plan.price}</span>
                    </>
                  )}
                  <span className="text-small text-ink-500">/ {plan.unit}</span>
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-body text-ink-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isFree ? (
                    <Button size="lg" className="w-full" asChild>
                      <Link href="/projects/new">{plan.cta}</Link>
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full"
                      variant={isHighlighted ? "default" : "outline"}
                      disabled={isPending || isQrOpen}
                      onClick={() => handlePayClick(key as OrderType)}
                    >
                      {isPending && !isQrOpen ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          生成订单中...
                        </>
                      ) : (
                        plan.cta
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </section>

        {/* 使用流程 */}
        <section className="mt-20">
          <h2 className="text-center text-h2 font-semibold text-ink-900">
            自助开通流程
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-4">
            {[
              { icon: Upload, title: "免费体检", desc: "上传问卷题目，免费确认方案可行性" },
              { icon: MousePointerClick, title: "选择方案", desc: "根据需求选择单次预演/完整报告/学期包" },
              { icon: QrCode, title: "扫码支付", desc: "微信/支付宝扫码，自助下单" },
              { icon: Rocket, title: "即刻使用", desc: "支付成功后套餐自动激活，立即预演" },
            ].map((item, i) => (
              <div key={item.title} className="relative text-center">
                {/* 连接线（sm+ 屏幕） */}
                {i < 3 && (
                  <div className="absolute left-[60%] top-5 hidden h-px w-[80%] bg-border sm:block" />
                )}
                <div className="relative mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold text-ink-900">{item.title}</h3>
                <p className="mt-1 text-body text-ink-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-20">
          <h2 className="text-center text-h2 font-semibold text-ink-900">常见问题</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              { q: "免费体检包含什么？", a: "题目上传与解析、维度归属推断、题型与反向题识别、样本代表性诊断。可确认题目设计是否可行，永久免费。" },
              { q: "单次预演和完整报告有什么区别？", a: "单次预演包含基础模拟+统计+导出；完整报告额外包含 AI 诊断结论、全格式导出（PDF/PPT）、样本量规划、报告润色等。推荐毕设生选完整报告。" },
              { q: "数据可以用于论文吗？", a: `不可以。所有数据强制带 "${SIMULATED_WATERMARK}" 水印，仅用于研究可行性预演，帮助你在正式收集数据前确认方案可行。` },
              { q: "学期包适合什么情况？", a: "如果你有多份问卷需要预演（如多个研究课题、帮同学做），学期包 180 天不限次使用，性价比最高。" },
            ].map((item) => (
              <Card key={item.q} className="p-5">
                <h4 className="font-medium text-ink-900">{item.q}</h4>
                <p className="mt-2 text-body text-ink-500">{item.a}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* 联系入口 */}
        <Card className="mt-20 p-8 text-center">
          <h2 className="text-h2 font-semibold text-ink-900">不确定选哪个？</h2>
          <p className="mx-auto mt-2 max-w-xl text-body text-ink-500">
            加客服微信或留言说明你的课题，帮你判断方案是否适合。
          </p>
          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-3">
            <WechatEntry
              trigger={<Button variant="outline" size="lg">加客服微信</Button>}
            />
            <ContactForm
              defaultTag="presale"
              entryPoint="pricing"
              trigger={<Button variant="outline" size="lg">留言咨询</Button>}
            />
          </div>
        </Card>

        <p className="mt-10 text-center text-caption text-ink-400">{DISCLAIMER}</p>
      </main>

      {/* 支付方式选择弹窗 */}
      <Dialog open={showMethodDialog} onOpenChange={setShowMethodDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择支付方式</DialogTitle>
            <DialogDescription>
              请选择扫码支付渠道，支付成功后套餐自动激活。
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2.5"
              onClick={() => handleMethodSelect("wechat")}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#07c160]/10 text-[#07c160]">
                <MessageCircle className="h-5 w-5" />
              </div>
              <span className="text-body font-medium">微信支付</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2.5"
              onClick={() => handleMethodSelect("alipay")}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1677ff]/10 text-[#1677ff]">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="text-body font-medium">支付宝</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 微信扫码支付弹窗 */}
      <WechatPayQrModal
        open={wechatPay.qrState.open}
        codeUrl={wechatPay.qrState.codeUrl}
        onClose={wechatPay.closeQr}
      />

      {/* 支付宝扫码支付弹窗 */}
      <AlipayQrModal
        open={alipay.qrState.open}
        qrCode={alipay.qrState.qrCode}
        onClose={alipay.closeQr}
      />

      {/* 支付错误提示 */}
      {payError && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-body text-destructive shadow-lg">
          <p className="font-medium">支付发起失败</p>
          <p className="mt-1 text-caption opacity-80">
            {payError instanceof Error ? payError.message : "请稍后重试或联系客服"}
          </p>
        </div>
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PricingContent />
    </Suspense>
  );
}
