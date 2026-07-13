import Link from "next/link";
import { Check, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Plan = {
  name: string;
  price: number;
  unit: string;
  badge?: string;
  features: readonly string[];
  locked: readonly string[];
};

/**
 * 定价卡。对应 PRICING 三层定价（免费 / 单次 / 订阅）。
 * 用于营销定价页。
 */
export function PriceTag({
  plan,
  ctaLabel = "选择此方案",
  highlighted = false,
  ctaHref,
  onCta,
}: {
  plan: Plan;
  ctaLabel?: string;
  highlighted?: boolean;
  ctaHref?: string;
  onCta?: () => void;
}) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col p-6",
        highlighted && "border-primary shadow-md ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-h2 font-semibold text-ink-900">{plan.name}</h3>
        {plan.badge ? (
          <Badge variant="warning" className="font-normal">
            {plan.badge}
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold tabular text-ink-900">
          ¥{plan.price.toFixed(plan.price === 0 ? 0 : 1)}
        </span>
        {plan.unit ? (
          <span className="text-body text-ink-500">{plan.unit}</span>
        ) : null}
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-body text-ink-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>{f}</span>
          </li>
        ))}
        {plan.locked.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-body text-ink-400"
          >
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="line-through">{f}</span>
          </li>
        ))}
      </ul>

      {ctaHref ? (
        <Button asChild variant={highlighted ? "default" : "outline"} className="mt-8 w-full">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      ) : (
        <Button
          onClick={onCta}
          variant={highlighted ? "default" : "outline"}
          className="mt-8 w-full"
        >
          {ctaLabel}
        </Button>
      )}
    </Card>
  );
}
