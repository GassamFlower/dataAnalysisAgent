"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { SampleSizeCalculator } from "@/components/tutorial/SampleSizeCalculator";

/**
 * 样本量计算器（免费工具页）。
 * 独立入口：/learn/tools/sample-size
 */
export default function SampleSizeToolPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <div className="container mx-auto max-w-3xl space-y-6 p-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/learn">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回小课堂
          </Link>
        </Button>

        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-ink-900">样本量计算器</h1>
          <p className="text-muted-foreground">
            自由输入参数，快速估算论文所需的有效样本量。
          </p>
        </div>

        <SampleSizeCalculator />
      </div>
    </div>
  );
}