"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthMutations } from "@/lib/hooks/use-auth";
import { toast } from "@/components/ui/toaster";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuthMutations();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const loading = forgotPassword.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    forgotPassword.mutate(email, {
      onSuccess: (data) => {
        toast.success(data.message || "重置链接已发送");
        setSent(true);
      },
      onError: (e) => {
        setError(e instanceof Error ? e.message : "请求失败，请重试");
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <Link
        href="/login"
        className="absolute left-6 top-6 inline-flex items-center text-body text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        返回登录
      </Link>

      <Card className="w-full max-w-sm p-8">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-ink-900">
            重置密码
          </h1>
          <p className="mt-2 text-body text-ink-500">
            {sent ? "重置链接已发送" : "输入注册邮箱，我们将发送重置链接"}
          </p>
        </div>

        {sent ? (
          <div className="mt-8 flex flex-col items-center gap-4">
            <CheckCircle className="h-12 w-12 text-success" />
            <p className="text-center text-body text-ink-700">
              如果该邮箱已注册，您将收到一封密码重置邮件。
              <br />
              请检查收件箱（含垃圾邮件文件夹）。
            </p>
            <Button variant="outline" onClick={() => setSent(false)} className="mt-2">
              重新输入邮箱
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">注册邮箱</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-ink-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-center text-caption text-red-600">{error}</p>
            )}

            <Button type="submit" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  发送中...
                </>
              ) : (
                "发送重置链接"
              )}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-caption text-ink-400">
          想起密码了？{" "}
          <Link href="/login" className="text-primary hover:underline">
            返回登录
          </Link>
        </p>
      </Card>
    </div>
  );
}
