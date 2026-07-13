import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DISCLAIMER } from "@/lib/constants";

export const metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex items-center text-body text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        返回首页
      </Link>

      <Card className="w-full max-w-sm p-8">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-ink-900">
            登录预演
          </h1>
          <p className="mt-2 text-body text-ink-500">
            微信扫码登录，开始你的研究预演
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-dashed border-border bg-cream-surface">
            <QrCode className="h-16 w-16 text-ink-400" />
          </div>
          <p className="mt-4 text-caption text-ink-500">
            微信扫码 · 免注册即用
          </p>
        </div>

        <Button className="mt-8 w-full" size="lg" asChild>
          <Link href="/projects">扫码登录</Link>
        </Button>

        <p className="mt-6 text-center text-caption text-ink-400">
          登录即同意《用户协议》与《预演数据使用须知》
        </p>
      </Card>

      <p className="mt-8 max-w-sm text-center text-caption text-ink-400">
        {DISCLAIMER}
      </p>
    </div>
  );
}
