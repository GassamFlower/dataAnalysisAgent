"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Lock, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<"register" | "verify">("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 注册表单
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");

  // 验证码
  const [code, setCode] = useState("");

  /** 提交注册 → 发送验证码 */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("两次密码输入不一致");
      return;
    }
    if (password.length < 6 || password.length > 32) {
      setError("密码长度需在 6~32 位之间");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nickname }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || "注册失败");
      }
      setStep("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  /** 验证邮箱 → 登录 */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || "验证失败");
      }
      const { token, user } = data.data;
      setAuth(
        {
          id: user.id,
          nickname: user.nickname,
          plan: user.plan ?? "free",
        },
        token
      );
      router.push("/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "验证失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  /** 重新发送验证码 */
  const handleResend = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || "发送失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败，请重试");
    } finally {
      setLoading(false);
    }
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
            {step === "register" ? "注册账号" : "验证邮箱"}
          </h1>
          <p className="mt-2 text-body text-ink-500">
            {step === "register"
              ? "填写邮箱和密码，注册你的账号"
              : `验证码已发送至 ${email}`}
          </p>
        </div>

        {step === "register" ? (
          <form onSubmit={handleRegister} className="mt-8 flex flex-col gap-4">
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
              <Label htmlFor="nickname">昵称（可选）</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-ink-400" />
                <Input
                  id="nickname"
                  type="text"
                  placeholder="你的昵称"
                  className="pl-9"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">密码（6~32 位）</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-ink-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="设置密码"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-ink-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="再次输入密码"
                  className="pl-9"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  注册中...
                </>
              ) : (
                "注册并发送验证码"
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">验证码</Label>
              <Input
                id="code"
                type="text"
                placeholder="请输入 6 位验证码"
                className="text-center text-lg tracking-widest"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>

            {error && (
              <p className="text-center text-caption text-red-600">{error}</p>
            )}

            <Button type="submit" size="lg" disabled={loading || code.length !== 6}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  验证中...
                </>
              ) : (
                "验证并登录"
              )}
            </Button>

            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="text-center text-caption text-ink-500 hover:text-ink-900"
            >
              没收到验证码？重新发送
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-caption text-ink-400">
          已有账号？{" "}
          <Link href="/login" className="text-primary hover:underline">
            返回登录
          </Link>
        </p>
      </Card>
    </div>
  );
}
