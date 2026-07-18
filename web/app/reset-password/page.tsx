"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthMutations } from "@/lib/hooks/use-auth";
import { toast } from "@/components/ui/toaster";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { resetPassword } = useAuthMutations();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const loading = resetPassword.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("两次密码输入不一致");
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 32) {
      setError("密码长度需在 6~32 位之间");
      return;
    }

    resetPassword.mutate(
      { token, newPassword },
      {
        onSuccess: (data) => {
          toast.success(data.message || "密码重置成功");
          setSuccess(true);
          setTimeout(() => router.push("/login"), 3000);
        },
        onError: (e) => {
          setError(e instanceof Error ? e.message : "重置失败，请重试");
        },
      }
    );
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
            设置新密码
          </h1>
          <p className="mt-2 text-body text-ink-500">
            {success ? "密码重置成功" : "请输入你的新密码"}
          </p>
        </div>

        {success ? (
          <div className="mt-8 flex flex-col items-center gap-4">
            <CheckCircle className="h-12 w-12 text-success" />
            <p className="text-center text-body text-ink-700">
              密码已重置成功，3 秒后自动跳转到登录页...
            </p>
            <Button onClick={() => router.push("/login")}>立即登录</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword">新密码（6~32 位）</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-ink-400" />
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="设置新密码"
                  className="pl-9"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-ink-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="再次输入新密码"
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

            <Button type="submit" size="lg" disabled={loading || !token}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  重置中...
                </>
              ) : (
                "重置密码"
              )}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
