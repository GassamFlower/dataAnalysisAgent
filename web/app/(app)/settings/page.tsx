"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  useCurrentUser,
  useUpdateProfile,
  useUpdatePassword,
  useRequestEmailChange,
  useConfirmEmailChange,
  useUploadAvatar,
} from "@/lib/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toaster";
import { Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  // 获取用户信息
  const { data: user, isLoading, refetch } = useCurrentUser();

  // 修改昵称
  const [nickname, setNickname] = useState("");
  const updateProfile = useUpdateProfile();

  // 修改密码
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const updatePassword = useUpdatePassword();

  // 修改邮箱
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailStep, setEmailStep] = useState<"input" | "verify">("input");
  const requestEmailChange = useRequestEmailChange();
  const confirmEmailChange = useConfirmEmailChange();

  // 上传头像
  const uploadAvatar = useUploadAvatar();

  const handleUpdateNickname = async () => {
    if (!nickname.trim()) {
      toast.error("请输入昵称");
      return;
    }
    try {
      await updateProfile.mutateAsync(nickname.trim());
      toast.success("昵称修改成功");
      setNickname("");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "昵称修改失败");
    }
  };

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("请填写完整");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次密码不一致");
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 32) {
      toast.error("密码长度需在 6~32 位之间");
      return;
    }
    try {
      await updatePassword.mutateAsync({ old_password: oldPassword, new_password: newPassword });
      toast.success("密码修改成功");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "密码修改失败");
    }
  };

  const handleRequestEmailChange = async () => {
    if (!newEmail.trim()) {
      toast.error("请输入新邮箱");
      return;
    }
    try {
      await requestEmailChange.mutateAsync(newEmail.trim());
      toast.success("验证码已发送至新邮箱");
      setEmailStep("verify");
    } catch (err: any) {
      toast.error(err.message || "发送失败");
    }
  };

  const handleConfirmEmailChange = async () => {
    if (!emailCode.trim()) {
      toast.error("请输入验证码");
      return;
    }
    try {
      await confirmEmailChange.mutateAsync({ new_email: newEmail.trim(), code: emailCode.trim() });
      toast.success("邮箱更新成功");
      setNewEmail("");
      setEmailCode("");
      setEmailStep("input");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "验证失败");
    }
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("文件大小不能超过 2MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }
    try {
      await uploadAvatar.mutateAsync(file);
      toast.success("头像上传成功");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "头像上传失败");
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">无法获取用户信息</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold">个人设置</h1>
        <p className="text-muted-foreground">管理你的账号信息和偏好设置</p>
      </div>

      {/* 头像与基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>你的头像和账号信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.avatar || undefined} />
              <AvatarFallback className="text-2xl">
                {user.nickname?.[0] || user.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div>
                <Label>头像</Label>
                <div className="mt-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80">
                    <Upload className="h-4 w-4" />
                    上传头像
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadAvatar}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>邮箱</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm">{user.email || "未绑定邮箱"}</span>
              {user.email_verified ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  已验证
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  未验证
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>昵称</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm">{user.nickname || "未设置"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>套餐</Label>
            <div className="flex items-center gap-2">
              <Badge variant={user.plan === "free" ? "secondary" : "default"}>
                {user.plan === "free" ? "免费版" : user.plan === "single" ? "单次解锁" : "订阅版"}
              </Badge>
              {user.plan_expires_at && (
                <span className="text-sm text-muted-foreground">
                  有效期至 {new Date(user.plan_expires_at).toLocaleDateString("zh-CN")}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 修改昵称 */}
      <Card>
        <CardHeader>
          <CardTitle>修改昵称</CardTitle>
          <CardDescription>更新你的显示名称</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">新昵称</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="请输入新昵称（1~20 个字符）"
              maxLength={20}
            />
          </div>
          <Button onClick={handleUpdateNickname} disabled={updateProfile.isPending}>
            {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存昵称
          </Button>
        </CardContent>
      </Card>

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>更新你的登录密码</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oldPassword">旧密码</Label>
            <Input
              id="oldPassword"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入旧密码"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">新密码</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（6~32 位）"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
            />
          </div>
          <Button onClick={handleUpdatePassword} disabled={updatePassword.isPending}>
            {updatePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            修改密码
          </Button>
        </CardContent>
      </Card>

      {/* 修改邮箱 */}
      <Card>
        <CardHeader>
          <CardTitle>修改邮箱</CardTitle>
          <CardDescription>更新你的登录邮箱</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailStep === "input" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="newEmail">新邮箱</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="请输入新邮箱地址"
                />
              </div>
              <Button onClick={handleRequestEmailChange} disabled={requestEmailChange.isPending}>
                {requestEmailChange.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                发送验证码
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="emailCode">验证码</Label>
                <Input
                  id="emailCode"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  placeholder="请输入发送至新邮箱的验证码"
                  maxLength={6}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleConfirmEmailChange} disabled={confirmEmailChange.isPending}>
                  {confirmEmailChange.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  确认修改
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailStep("input");
                    setEmailCode("");
                  }}
                >
                  取消
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 退出登录 */}
      <Card>
        <CardHeader>
          <CardTitle>退出登录</CardTitle>
          <CardDescription>退出当前账号</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleLogout}>
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
