"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/common/price-tag";
import { PageHeader } from "@/components/common/page-header";
import { PRICING, SIMULATED_WATERMARK } from "@/lib/constants";
import { usePurchasePlan, useSubscription } from "@/lib/hooks/use-payment";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { data: subscription } = useSubscription();
  const purchase = usePurchasePlan();

  const handlePurchase = async (planType: "single" | "subscription") => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    try {
      await purchase.mutateAsync(planType);
      router.push("/settings");
    } catch (err) {
      alert(err instanceof Error ? err.message : "购买失败，请重试");
    }
  };

  const currentPlan = subscription?.plan ?? "free";

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
          title="简单透明的定价"
          description="免费体检确认可行性，付费生成数据与完整报告。开题季早鸟价进行中。"
        />

        {subscription && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4 text-center text-body text-ink-700">
            当前套餐：
            <span className="font-semibold text-ink-900">
              {currentPlan === "free" && "免费体检"}
              {currentPlan === "single" && "单次报告"}
              {currentPlan === "subscription" && "月度订阅"}
            </span>
            {subscription.isActive && subscription.expiresAt && (
              <span className="ml-2 text-ink-500">
                有效期至 {new Date(subscription.expiresAt).toLocaleDateString("zh-CN")}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <PriceTag
            plan={PRICING.free}
            ctaLabel="免费开始"
            highlighted={false}
            ctaHref="/projects/new"
          />
          <PriceTag
            plan={PRICING.single}
            ctaLabel={currentPlan === "single" ? "已拥有" : "购买单次"}
            highlighted
            onCta={() => handlePurchase("single")}
          />
          <PriceTag
            plan={PRICING.subscription}
            ctaLabel={currentPlan === "subscription" ? "已拥有" : "订阅月度"}
            highlighted={false}
            onCta={() => handlePurchase("subscription")}
          />
        </div>

        <section className="mt-16">
          <h2 className="text-h2 font-semibold text-ink-900">常见问题</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-medium text-ink-900">免费体检包含什么？</h4>
              <p className="mt-2 text-body text-ink-500">
                题目上传解析、维度归属推断、题型与反向题识别。不包含数据生成与报告。
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-medium text-ink-900">单次和订阅的区别？</h4>
              <p className="mt-2 text-body text-ink-500">
                单次报告含 1 次完整预演；月度订阅不限次预演，适合开题季反复调整。
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
                R4 诊断会给出逐项修改建议，调整题目或假设后可重新预演（订阅不限次）。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
