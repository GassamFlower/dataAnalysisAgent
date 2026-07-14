"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DISCLAIMER } from "@/lib/constants";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`登录失败: ${res.status} ${text}`);
      }
      const data = await res.json();
      // data: { token, user: { id, nickname, plan } }
      setAuth(
        {
          id: data.user.id,
          nickname: data.user.nickname,
          plan: data.user.plan ?? "subscription",
        },
        data.token
      );
      router.push("/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

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
            点击登录，开始你的研究预演
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <Button
            className="w-full"
            size="lg"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              "测试账号登录"
            )}
          </Button>
          {error && (
            <p className="mt-3 text-caption text-red-600">{error}</p>
          )}
        </div>

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
