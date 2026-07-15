"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Lock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DISCLAIMER } from "@/lib/constants";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * 登录页入口：包裹 Suspense 边界（useSearchParams 要求）。
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  // 邮箱登录表单
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "missing_code") {
      setError("微信授权失败：未获取到授权码，请重试");
    } else if (err === "callback_failed") {
      const detail = searchParams.get("detail") ?? "";
      setError(`微信登录回调失败：${detail || "请重试"}`);
    }
  }, [searchParams]);

  const redirectPath = searchParams.get("redirect") ?? "/projects";

  const checkLoginStatus = useCallback(() => {
    try {
      const raw = localStorage.getItem("auth-storage");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed?.state?.isAuthenticated && parsed?.state?.token;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!qrOpen) return;
    const interval = setInterval(() => {
      if (checkLoginStatus()) {
        clearInterval(interval);
        setQrOpen(false);
        router.push(redirectPath);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [qrOpen, redirectPath, router, checkLoginStatus]);

  /** 邮箱登录 */
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || "登录失败");
      }
      // 后端返回 {code, message, data: {token, user}}
      const { token, user } = data.data;
      setAuth(
        {
          id: user.id,
          nickname: user.nickname,
          plan: user.plan ?? "free",
        },
        token
      );
      router.push(redirectPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  /** 测试账号登录 */
  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST" });
      if (!res.ok) throw new Error(`登录失败: ${res.status}`);
      const data = await res.json();
      setAuth(
        {
          id: data.user.id,
          nickname: data.user.nickname,
          plan: data.user.plan ?? "subscription",
        },
        data.token
      );
      router.push(redirectPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  /** 微信扫码登录 */
  const handleWechatLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/auth/wechat-url?redirect=${encodeURIComponent(redirectPath)}`
      );
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.message || "微信登录未配置");
      }
      setQrUrl(data.url);
      setQrOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "微信登录失败，请重试");
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
            使用邮箱登录，开始你的研究预演
          </p>
        </div>

        {/* 邮箱登录表单 */}
        <form onSubmit={handleEmailLogin} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">邮箱</Label>
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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">密码</Label>
              <Link
                href="/forgot-password"
                className="text-caption text-ink-500 hover:text-ink-900"
              >
                忘记密码？
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-ink-400" />
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                className="pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                登录中...
              </>
            ) : (
              "邮箱登录"
            )}
          </Button>
        </form>

        {/* 分隔线 */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-caption text-ink-400">或</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* 其他登录方式 */}
        <div className="flex flex-col items-center gap-3">
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleWechatLogin}
            disabled={loading}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.69 4C5.43 4 2.8 6.13 2.8 8.78c0 1.49.83 2.83 2.13 3.74l-.53 1.6 1.86-.94c.66.13 1.3.27 1.99.27.18 0 .35-.02.53-.03-.11-.38-.18-.78-.18-1.2 0-2.46 2.12-4.46 4.74-4.46.17 0 .33.01.5.03-.5-2.3-2.94-3.99-5.15-3.99zM6.9 7.44c-.4 0-.73-.33-.73-.73s.33-.73.73-.73.73.33.73.73-.33.73-.73.73zm3.6 0c-.4 0-.73-.33-.73-.73s.33-.73.73-.73.73.33.73.73-.33.73-.73.73zm3.58 1.52c-2.36 0-4.27 1.7-4.27 3.8 0 2.1 1.91 3.8 4.27 3.8.5 0 .99-.08 1.45-.22l1.32.67-.36-1.1c.96-.69 1.86-1.66 1.86-3.15 0-2.1-1.91-3.8-4.27-3.8zm-1.42 1.1c-.27 0-.49-.22-.49-.49s.22-.49.49-.49.49.22.49.49-.22.49-.49.49zm2.84 0c-.27 0-.49-.22-.49-.49s.22-.49.49-.49.49.22.49.49-.22.49-.49.49z"/>
            </svg>
            微信扫码登录
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDevLogin}
            disabled={loading}
            className="text-ink-500"
          >
            测试账号登录
          </Button>
        </div>

        <p className="mt-6 text-center text-caption text-ink-400">
          还没有账号？{" "}
          <Link href="/register" className="text-primary hover:underline">
            立即注册
          </Link>
        </p>

        <p className="mt-4 text-center text-caption text-ink-400">
          登录即同意《用户协议》与《预演数据使用须知》
        </p>
      </Card>

      <p className="mt-8 max-w-sm text-center text-caption text-ink-400">
        {DISCLAIMER}
      </p>

      {/* 微信扫码二维码弹窗 */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">微信扫码登录</DialogTitle>
            <DialogDescription className="text-center">
              请使用微信扫一扫，扫描下方二维码完成授权
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrUrl ? (
              <div className="rounded-lg border border-border bg-white p-3">
                <QRCodeSVG value={qrUrl} size={200} level="M" />
              </div>
            ) : (
              <Loader2 className="h-10 w-10 animate-spin text-ink-400" />
            )}
            <p className="text-center text-caption text-ink-500">
              扫码后请在微信内点击授权
              <br />
              授权完成后本页面将自动跳转
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
